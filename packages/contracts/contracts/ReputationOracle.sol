// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IReputationOracle} from "./interfaces/IReputationOracle.sol";

/// @title ReputationOracle
/// @notice Aggregates per-round agent performance into a running on-chain score.
/// @dev    Single trusted reporter for v1. Each (agentId, roundId) pair can
///         only be recorded once to prevent double-counting.
contract ReputationOracle is Ownable, IReputationOracle {
    struct AgentReputation {
        int256 totalScore;
        uint256 roundCount;
    }

    IAgentGenome public immutable agentGenome;
    address public reporter;

    mapping(uint256 => AgentReputation) private _reputations;
    mapping(uint256 => mapping(uint256 => bool)) private _recorded;
    mapping(uint256 => mapping(uint256 => int256)) private _roundScores;

    error NotReporter();
    error AlreadyRecorded(uint256 agentId, uint256 roundId);
    error LengthMismatch();

    modifier onlyReporter() {
        if (msg.sender != reporter) revert NotReporter();
        _;
    }

    constructor(address initialOwner, IAgentGenome agentGenome_) Ownable(initialOwner) {
        agentGenome = agentGenome_;
    }

    /// @notice Rotate the trusted reporter.
    function setReporter(address newReporter) external onlyOwner {
        reporter = newReporter;
        emit ReporterUpdated(newReporter);
    }

    /// @inheritdoc IReputationOracle
    function recordPerformance(uint256 agentId, uint256 roundId, int256 score)
        external
        onlyReporter
    {
        _record(agentId, roundId, score);
    }

    /// @inheritdoc IReputationOracle
    function recordBatch(uint256[] calldata agentIds, uint256 roundId, int256[] calldata scores)
        external
        onlyReporter
    {
        if (agentIds.length != scores.length) revert LengthMismatch();
        for (uint256 i = 0; i < agentIds.length; i++) {
            _record(agentIds[i], roundId, scores[i]);
        }
    }

    /// @inheritdoc IReputationOracle
    function scoreOf(uint256 agentId) external view returns (int256) {
        return _reputations[agentId].totalScore;
    }

    /// @inheritdoc IReputationOracle
    function roundCountOf(uint256 agentId) external view returns (uint256) {
        return _reputations[agentId].roundCount;
    }

    /// @inheritdoc IReputationOracle
    function roundScoreOf(uint256 agentId, uint256 roundId)
        external
        view
        returns (int256 score, bool recorded)
    {
        return (_roundScores[agentId][roundId], _recorded[agentId][roundId]);
    }

    /// @inheritdoc IReputationOracle
    function averageScoreOf(uint256 agentId) external view returns (int256) {
        AgentReputation storage rep = _reputations[agentId];
        if (rep.roundCount == 0) return 0;
        return rep.totalScore / int256(rep.roundCount);
    }

    function _record(uint256 agentId, uint256 roundId, int256 score) internal {
        agentGenome.ownerOf(agentId);
        if (_recorded[agentId][roundId]) revert AlreadyRecorded(agentId, roundId);

        _recorded[agentId][roundId] = true;
        _roundScores[agentId][roundId] = score;

        AgentReputation storage rep = _reputations[agentId];
        rep.totalScore += score;
        rep.roundCount += 1;

        emit PerformanceRecorded(agentId, roundId, score, rep.totalScore, rep.roundCount);
    }
}
