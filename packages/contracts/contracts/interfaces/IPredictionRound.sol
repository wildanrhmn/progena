// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPredictionRound
/// @notice Tournament arena for prediction-vertical Progena agents. Uses a
///         commit-reveal scheme so an agent's prediction is sealed during
///         the commit window (preventing copy-trading), revealed during the
///         reveal window, and scored after the round resolves.
/// @dev    Predictions and outcomes are expressed in basis points
///         (0-10000). Score for a revealed prediction is
///         `10000 - 2 * |prediction - outcome|`, which is symmetric in
///         [-10000, +10000]. Unrevealed commitments are silently skipped
///         when scoring.
interface IPredictionRound {
    enum RoundStatus {
        NonExistent,
        Open,
        RevealPhase,
        Closed,
        Resolved
    }

    /// @param questionHash    Off-chain question fingerprint (text stored elsewhere).
    /// @param commitDeadline  Last timestamp at which commits are accepted.
    /// @param revealDeadline  Last timestamp at which reveals are accepted.
    /// @param outcome         Resolved outcome in bps (0..10000); zero before resolution.
    /// @param resolved        True once `resolveRound` has been called.
    /// @param totalCommitted  Number of agents that committed.
    /// @param totalRevealed   Number of those that subsequently revealed.
    struct RoundData {
        bytes32 questionHash;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint16 outcome;
        bool resolved;
        uint256 totalCommitted;
        uint256 totalRevealed;
    }

    struct CommitmentData {
        bytes32 commitHash;
        uint16 prediction;
        bool revealed;
        bool exists;
    }

    event RoundCreated(
        uint256 indexed roundId,
        bytes32 questionHash,
        uint64 commitDeadline,
        uint64 revealDeadline
    );
    event PredictionCommitted(
        uint256 indexed roundId,
        uint256 indexed agentId,
        address indexed committer,
        bytes32 commitHash
    );
    event PredictionRevealed(uint256 indexed roundId, uint256 indexed agentId, uint16 prediction);
    event RoundResolved(uint256 indexed roundId, uint16 outcome, uint256 scoredAgents);

    /// @notice Create a new round. Only callable by the contract owner.
    function createRound(bytes32 questionHash, uint64 commitDeadline, uint64 revealDeadline)
        external
        returns (uint256 roundId);

    /// @notice Commit a sealed prediction for `agentId` in `roundId`.
    ///         Caller must own the agent. `commitHash` MUST equal
    ///         `keccak256(abi.encode(roundId, agentId, prediction, nonce))`.
    function commitPrediction(uint256 roundId, uint256 agentId, bytes32 commitHash) external;

    /// @notice Reveal a previously committed prediction. Anyone may call;
    ///         only those who know the original `(prediction, nonce)` can
    ///         produce a hash that matches the commit.
    function revealPrediction(uint256 roundId, uint256 agentId, uint16 prediction, bytes32 nonce)
        external;

    /// @notice Resolve a round with the actual outcome (bps). Computes
    ///         scores for all revealed predictions and forwards them to
    ///         the reputation oracle in one batch.
    function resolveRound(uint256 roundId, uint16 outcome) external;

    function statusOf(uint256 roundId) external view returns (RoundStatus);
    function roundOf(uint256 roundId) external view returns (RoundData memory);
    function commitmentOf(uint256 roundId, uint256 agentId)
        external
        view
        returns (CommitmentData memory);
    function agentsOf(uint256 roundId) external view returns (uint256[] memory);
    function nextRoundId() external view returns (uint256);
}
