// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IAgentMemory} from "./interfaces/IAgentMemory.sol";

/// @title AgentMemory
/// @notice Records an append-only list of memory shard root hashes per
///         agent. Shards live on 0G Storage; this contract is the
///         on-chain index so that future rounds can deterministically
///         look up an agent's accumulated lessons.
contract AgentMemory is Ownable, IAgentMemory {
    IAgentGenome public immutable agentGenome;
    address public memoryWriter;

    mapping(uint256 => bytes32[]) private _shards;

    error NotMemoryWriter();
    error InvalidShard();
    error IndexOutOfRange(uint256 agentId, uint256 index);

    modifier onlyMemoryWriter() {
        if (msg.sender != memoryWriter) revert NotMemoryWriter();
        _;
    }

    constructor(address initialOwner, IAgentGenome agentGenome_) Ownable(initialOwner) {
        agentGenome = agentGenome_;
    }

    /// @notice Rotate the trusted memory writer.
    function setMemoryWriter(address newMemoryWriter) external onlyOwner {
        memoryWriter = newMemoryWriter;
        emit MemoryWriterUpdated(newMemoryWriter);
    }

    /// @inheritdoc IAgentMemory
    function addShard(uint256 agentId, bytes32 shardRootHash) external onlyMemoryWriter {
        if (shardRootHash == bytes32(0)) revert InvalidShard();
        agentGenome.ownerOf(agentId);

        _shards[agentId].push(shardRootHash);
        uint256 index = _shards[agentId].length - 1;
        emit ShardAdded(agentId, shardRootHash, index);
    }

    /// @inheritdoc IAgentMemory
    function shardsOf(uint256 agentId) external view returns (bytes32[] memory) {
        return _shards[agentId];
    }

    /// @inheritdoc IAgentMemory
    function shardCountOf(uint256 agentId) external view returns (uint256) {
        return _shards[agentId].length;
    }

    /// @inheritdoc IAgentMemory
    function shardAt(uint256 agentId, uint256 index) external view returns (bytes32) {
        if (index >= _shards[agentId].length) revert IndexOutOfRange(agentId, index);
        return _shards[agentId][index];
    }

    /// @inheritdoc IAgentMemory
    function recentShardsOf(uint256 agentId, uint256 n)
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage all = _shards[agentId];
        uint256 total = all.length;
        if (n == 0 || total == 0) return new bytes32[](0);

        uint256 take = n > total ? total : n;
        uint256 start = total - take;
        bytes32[] memory out = new bytes32[](take);
        for (uint256 i = 0; i < take; i++) {
            out[i] = all[start + i];
        }
        return out;
    }
}
