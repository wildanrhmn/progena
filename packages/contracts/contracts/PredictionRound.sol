// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IReputationOracle} from "./interfaces/IReputationOracle.sol";
import {IPredictionRound} from "./interfaces/IPredictionRound.sol";

/// @title PredictionRound
/// @notice Commit-reveal prediction arena with an entry-fee + sponsor pool.
///         Owner creates rounds, agent owners opt in per round (paying the
///         entry fee), reveal during the reveal window, then the owner
///         resolves with the actual outcome. The pool is split among
///         positive-scoring agents weighted by score; payouts are credited
///         to each agent's owner and claimable via {withdrawPayout}.
/// @dev    Must be set as the `reporter` on {ReputationOracle} for
///         resolution to succeed. If a round has no positive scorers, the
///         pool stays in the contract (recoverable via a future governance
///         action — out of MVP scope).
contract PredictionRound is Ownable, ReentrancyGuard, IPredictionRound {
    uint16 public constant MAX_PREDICTION = 10_000;

    IAgentGenome public immutable agentGenome;
    IReputationOracle public immutable reputationOracle;

    uint256 private _nextRoundId = 1;

    mapping(uint256 => RoundData) private _rounds;
    mapping(uint256 => uint256[]) private _agents;
    mapping(uint256 => mapping(uint256 => CommitmentData)) private _commitments;
    mapping(address => uint256) private _pendingPayouts;

    error RoundDoesNotExist(uint256 roundId);
    error RoundAlreadyResolved(uint256 roundId);
    error InvalidDeadlines();
    error NotInCommitPhase();
    error NotInRevealPhase();
    error RevealPhaseNotEnded();
    error NotAgentOwner(uint256 agentId);
    error AlreadyCommitted(uint256 roundId, uint256 agentId);
    error NoCommitment(uint256 roundId, uint256 agentId);
    error AlreadyRevealed(uint256 roundId, uint256 agentId);
    error InvalidReveal();
    error InvalidOutcome();
    error PredictionOutOfRange();
    error InsufficientEntryFee(uint256 required, uint256 sent);
    error NoSponsorAmount();
    error NoPayoutAvailable();
    error TransferFailed();

    constructor(
        address initialOwner,
        IAgentGenome agentGenome_,
        IReputationOracle reputationOracle_
    ) Ownable(initialOwner) {
        agentGenome = agentGenome_;
        reputationOracle = reputationOracle_;
    }

    /// @inheritdoc IPredictionRound
    function createRound(
        bytes32 questionHash,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint256 entryFee
    ) external onlyOwner returns (uint256 roundId) {
        if (commitDeadline <= block.timestamp) revert InvalidDeadlines();
        if (revealDeadline <= commitDeadline) revert InvalidDeadlines();

        roundId = _nextRoundId++;
        _rounds[roundId] = RoundData({
            questionHash: questionHash,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            outcome: 0,
            resolved: false,
            totalCommitted: 0,
            totalRevealed: 0,
            entryFee: entryFee,
            totalPool: 0
        });

        emit RoundCreated(roundId, questionHash, commitDeadline, revealDeadline, entryFee);
    }

    /// @inheritdoc IPredictionRound
    function commitPrediction(uint256 roundId, uint256 agentId, bytes32 commitHash)
        external
        payable
        nonReentrant
    {
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) revert RoundDoesNotExist(roundId);
        if (block.timestamp > round.commitDeadline) revert NotInCommitPhase();
        if (agentGenome.ownerOf(agentId) != msg.sender) revert NotAgentOwner(agentId);
        if (msg.value < round.entryFee) revert InsufficientEntryFee(round.entryFee, msg.value);

        CommitmentData storage c = _commitments[roundId][agentId];
        if (c.exists) revert AlreadyCommitted(roundId, agentId);

        c.commitHash = commitHash;
        c.exists = true;
        _agents[roundId].push(agentId);
        round.totalCommitted += 1;
        round.totalPool += round.entryFee;

        uint256 refund = msg.value - round.entryFee;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            if (!ok) revert TransferFailed();
        }

        emit PredictionCommitted(roundId, agentId, msg.sender, commitHash, round.entryFee);
    }

    /// @inheritdoc IPredictionRound
    function sponsorRound(uint256 roundId) external payable nonReentrant {
        if (msg.value == 0) revert NoSponsorAmount();
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) revert RoundDoesNotExist(roundId);
        if (round.resolved) revert RoundAlreadyResolved(roundId);

        round.totalPool += msg.value;
        emit PoolSponsored(roundId, msg.sender, msg.value);
    }

    /// @inheritdoc IPredictionRound
    function revealPrediction(uint256 roundId, uint256 agentId, uint16 prediction, bytes32 nonce)
        external
    {
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) revert RoundDoesNotExist(roundId);
        if (block.timestamp <= round.commitDeadline) revert NotInRevealPhase();
        if (block.timestamp > round.revealDeadline) revert NotInRevealPhase();
        if (prediction > MAX_PREDICTION) revert PredictionOutOfRange();

        CommitmentData storage c = _commitments[roundId][agentId];
        if (!c.exists) revert NoCommitment(roundId, agentId);
        if (c.revealed) revert AlreadyRevealed(roundId, agentId);

        bytes32 expected = keccak256(abi.encode(roundId, agentId, prediction, nonce));
        if (c.commitHash != expected) revert InvalidReveal();

        c.prediction = prediction;
        c.revealed = true;
        round.totalRevealed += 1;

        emit PredictionRevealed(roundId, agentId, prediction);
    }

    /// @inheritdoc IPredictionRound
    function resolveRound(uint256 roundId, uint16 outcome) external onlyOwner {
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) revert RoundDoesNotExist(roundId);
        if (round.resolved) revert RoundAlreadyResolved(roundId);
        if (block.timestamp <= round.revealDeadline) revert RevealPhaseNotEnded();
        if (outcome > MAX_PREDICTION) revert InvalidOutcome();

        round.outcome = outcome;
        round.resolved = true;

        uint256[] storage agents = _agents[roundId];
        uint256 revealedCount;
        for (uint256 i = 0; i < agents.length; i++) {
            if (_commitments[roundId][agents[i]].revealed) revealedCount++;
        }

        uint256 totalPaidOut;

        if (revealedCount > 0) {
            uint256[] memory scoredIds = new uint256[](revealedCount);
            int256[] memory scores = new int256[](revealedCount);
            uint256 idx;
            int256 outcomeI = int256(uint256(outcome));
            uint256 totalPositiveScore;

            for (uint256 i = 0; i < agents.length; i++) {
                uint256 agentId = agents[i];
                CommitmentData storage c = _commitments[roundId][agentId];
                if (!c.revealed) continue;

                int256 distance = int256(uint256(c.prediction)) - outcomeI;
                if (distance < 0) distance = -distance;
                int256 score = int256(uint256(MAX_PREDICTION)) - 2 * distance;

                scoredIds[idx] = agentId;
                scores[idx] = score;
                idx++;

                if (score > 0) {
                    totalPositiveScore += uint256(score);
                }
            }

            reputationOracle.recordBatch(scoredIds, roundId, scores);

            if (totalPositiveScore > 0 && round.totalPool > 0) {
                for (uint256 i = 0; i < scoredIds.length; i++) {
                    if (scores[i] <= 0) continue;
                    uint256 share = (round.totalPool * uint256(scores[i])) / totalPositiveScore;
                    if (share == 0) continue;
                    address beneficiary = agentGenome.ownerOf(scoredIds[i]);
                    _pendingPayouts[beneficiary] += share;
                    totalPaidOut += share;
                    emit PayoutCredited(beneficiary, roundId, scoredIds[i], share);
                }
            }
        }

        emit RoundResolved(roundId, outcome, revealedCount, totalPaidOut);
    }

    /// @inheritdoc IPredictionRound
    function withdrawPayout() external nonReentrant returns (uint256 amount) {
        amount = _pendingPayouts[msg.sender];
        if (amount == 0) revert NoPayoutAvailable();
        _pendingPayouts[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PayoutWithdrawn(msg.sender, amount);
    }

    /// @inheritdoc IPredictionRound
    function pendingPayoutOf(address beneficiary) external view returns (uint256) {
        return _pendingPayouts[beneficiary];
    }

    /// @inheritdoc IPredictionRound
    function statusOf(uint256 roundId) external view returns (RoundStatus) {
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) return RoundStatus.NonExistent;
        if (round.resolved) return RoundStatus.Resolved;
        if (block.timestamp <= round.commitDeadline) return RoundStatus.Open;
        if (block.timestamp <= round.revealDeadline) return RoundStatus.RevealPhase;
        return RoundStatus.Closed;
    }

    /// @inheritdoc IPredictionRound
    function roundOf(uint256 roundId) external view returns (RoundData memory) {
        if (_rounds[roundId].commitDeadline == 0) revert RoundDoesNotExist(roundId);
        return _rounds[roundId];
    }

    /// @inheritdoc IPredictionRound
    function commitmentOf(uint256 roundId, uint256 agentId)
        external
        view
        returns (CommitmentData memory)
    {
        return _commitments[roundId][agentId];
    }

    /// @inheritdoc IPredictionRound
    function agentsOf(uint256 roundId) external view returns (uint256[] memory) {
        return _agents[roundId];
    }

    /// @inheritdoc IPredictionRound
    function nextRoundId() external view returns (uint256) {
        return _nextRoundId;
    }
}
