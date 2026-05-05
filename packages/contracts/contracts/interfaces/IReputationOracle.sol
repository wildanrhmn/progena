// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IReputationOracle
/// @notice On-chain agent reputation aggregator. The off-chain orchestrator
///         posts signed per-round per-agent scores; the contract aggregates
///         a running total and round count for each agent so that consumers
///         (marketplace, breeding UI, ranking views) can read reputation
///         directly from chain.
/// @dev    Scores are int256 to allow negative outcomes (losses, penalties).
///         The trusted reporter is settable by the owner. In v1 it is the
///         orchestrator EOA; later it can be rotated to a multisig or to
///         a contract that verifies TEE attestations on-chain.
interface IReputationOracle {
    /// @notice Emitted on every recorded score, including the agent's
    ///         updated running total and round count for indexers.
    event PerformanceRecorded(
        uint256 indexed agentId,
        uint256 indexed roundId,
        int256 score,
        int256 runningTotal,
        uint256 runningCount
    );

    /// @notice Emitted when the trusted reporter is rotated.
    event ReporterUpdated(address indexed reporter);

    /// @notice Record a single agent's score for a round.
    function recordPerformance(uint256 agentId, uint256 roundId, int256 score) external;

    /// @notice Record many agents' scores for the same round in one tx.
    function recordBatch(uint256[] calldata agentIds, uint256 roundId, int256[] calldata scores)
        external;

    /// @notice Aggregate score across all recorded rounds.
    function scoreOf(uint256 agentId) external view returns (int256);

    /// @notice Number of rounds an agent has been recorded in.
    function roundCountOf(uint256 agentId) external view returns (uint256);

    /// @notice Score for a specific round, plus a flag indicating whether
    ///         this (agent, round) pair has actually been recorded.
    function roundScoreOf(uint256 agentId, uint256 roundId)
        external
        view
        returns (int256 score, bool recorded);

    /// @notice Mean score per round. Returns 0 for agents with no recorded rounds.
    function averageScoreOf(uint256 agentId) external view returns (int256);
}
