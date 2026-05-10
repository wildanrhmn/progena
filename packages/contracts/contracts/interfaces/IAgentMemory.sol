// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAgentMemory
/// @notice Append-only on-chain pointer index for an agent's accumulated
///         memory shards. Each shard is a small JSON file stored on
///         0G Storage; this contract records the storage root hash so
///         consumers can fetch and feed past lessons back into the
///         agent's inference context for future rounds.
/// @dev    Single trusted writer for v1 (the orchestrator that resolves
///         rounds and runs the lesson summarization). Reads are public
///         and free.
interface IAgentMemory {
    /// @notice Emitted on every shard append.
    event ShardAdded(
        uint256 indexed agentId,
        bytes32 indexed shardRootHash,
        uint256 indexed index
    );

    /// @notice Emitted when the trusted memory writer is rotated.
    event MemoryWriterUpdated(address indexed memoryWriter);

    /// @notice Append a new memory shard for an agent.
    function addShard(uint256 agentId, bytes32 shardRootHash) external;

    /// @notice All shards for an agent, in append order.
    function shardsOf(uint256 agentId) external view returns (bytes32[] memory);

    /// @notice Number of shards recorded for an agent.
    function shardCountOf(uint256 agentId) external view returns (uint256);

    /// @notice Single shard at a specific index for an agent.
    function shardAt(uint256 agentId, uint256 index) external view returns (bytes32);

    /// @notice The most recent `n` shards for an agent (or fewer if not enough exist).
    function recentShardsOf(uint256 agentId, uint256 n) external view returns (bytes32[] memory);
}
