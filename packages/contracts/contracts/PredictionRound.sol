// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IReputationOracle} from "./interfaces/IReputationOracle.sol";
import {IPredictionRound} from "./interfaces/IPredictionRound.sol";

/// @title PredictionRound
/// @notice Commit-reveal prediction arena. Owner creates rounds, agent
///         owners commit sealed predictions, then reveal during the reveal
///         window, then the owner resolves with the actual outcome.
///         Resolution computes per-agent scores and posts them to the
///         reputation oracle as a single batch.
/// @dev    Must be set as the `reporter` on {ReputationOracle} for
///         resolution to succeed.
contract PredictionRound is Ownable, IPredictionRound {
    uint16 public constant MAX_PREDICTION = 10_000;

    IAgentGenome public immutable agentGenome;
    IReputationOracle public immutable reputationOracle;

    uint256 private _nextRoundId = 1;

    mapping(uint256 => RoundData) private _rounds;
    mapping(uint256 => uint256[]) private _agents;
    mapping(uint256 => mapping(uint256 => CommitmentData)) private _commitments;

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

    constructor(
        address initialOwner,
        IAgentGenome agentGenome_,
        IReputationOracle reputationOracle_
    ) Ownable(initialOwner) {
        agentGenome = agentGenome_;
        reputationOracle = reputationOracle_;
    }

    /// @inheritdoc IPredictionRound
    function createRound(bytes32 questionHash, uint64 commitDeadline, uint64 revealDeadline)
        external
        onlyOwner
        returns (uint256 roundId)
    {
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
            totalRevealed: 0
        });

        emit RoundCreated(roundId, questionHash, commitDeadline, revealDeadline);
    }

    /// @inheritdoc IPredictionRound
    function commitPrediction(uint256 roundId, uint256 agentId, bytes32 commitHash) external {
        RoundData storage round = _rounds[roundId];
        if (round.commitDeadline == 0) revert RoundDoesNotExist(roundId);
        if (block.timestamp > round.commitDeadline) revert NotInCommitPhase();
        if (agentGenome.ownerOf(agentId) != msg.sender) revert NotAgentOwner(agentId);

        CommitmentData storage c = _commitments[roundId][agentId];
        if (c.exists) revert AlreadyCommitted(roundId, agentId);

        c.commitHash = commitHash;
        c.exists = true;
        _agents[roundId].push(agentId);
        round.totalCommitted += 1;

        emit PredictionCommitted(roundId, agentId, msg.sender, commitHash);
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

        if (revealedCount > 0) {
            uint256[] memory scoredIds = new uint256[](revealedCount);
            int256[] memory scores = new int256[](revealedCount);
            uint256 idx;
            int256 outcomeI = int256(uint256(outcome));

            for (uint256 i = 0; i < agents.length; i++) {
                uint256 agentId = agents[i];
                CommitmentData storage c = _commitments[roundId][agentId];
                if (!c.revealed) continue;

                int256 distance = int256(uint256(c.prediction)) - outcomeI;
                if (distance < 0) distance = -distance;
                scoredIds[idx] = agentId;
                scores[idx] = int256(uint256(MAX_PREDICTION)) - 2 * distance;
                idx++;
            }

            reputationOracle.recordBatch(scoredIds, roundId, scores);
        }

        emit RoundResolved(roundId, outcome, revealedCount);
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
