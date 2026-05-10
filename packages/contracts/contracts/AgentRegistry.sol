// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";

/// @title AgentRegistry
/// @notice Lightweight, ownerless name claim registry for AgentGenome tokens.
///         Names follow ENS-ish rules but are case-sensitive on-chain: the
///         literal bytes of the chosen name decide both display and
///         uniqueness, so "Alpha" and "alpha" are distinct claims.
contract AgentRegistry is IAgentRegistry {
    IAgentGenome public immutable agentGenome;

    uint256 public constant MIN_NAME_LENGTH = 2;
    uint256 public constant MAX_NAME_LENGTH = 32;

    mapping(uint256 => string) private _names;
    mapping(bytes32 => uint256) private _claimedBy;

    error NotTokenOwner(uint256 tokenId, address caller);
    error NameAlreadySet(uint256 tokenId);
    error NameAlreadyClaimed(uint256 byTokenId);
    error InvalidNameLength();
    error InvalidNameCharacter(uint256 index, bytes1 char);

    constructor(IAgentGenome agentGenome_) {
        agentGenome = agentGenome_;
    }

    /// @inheritdoc IAgentRegistry
    function setName(uint256 tokenId, string calldata name) external {
        if (agentGenome.ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }
        if (bytes(_names[tokenId]).length != 0) {
            revert NameAlreadySet(tokenId);
        }

        bytes memory nameBytes = bytes(name);
        uint256 len = nameBytes.length;
        if (len < MIN_NAME_LENGTH || len > MAX_NAME_LENGTH) {
            revert InvalidNameLength();
        }
        _validateChars(nameBytes);

        bytes32 key = keccak256(nameBytes);
        uint256 existing = _claimedBy[key];
        if (existing != 0) {
            revert NameAlreadyClaimed(existing - 1);
        }

        _names[tokenId] = name;
        _claimedBy[key] = tokenId + 1;
        emit NameSet(tokenId, name, msg.sender);
    }

    /// @inheritdoc IAgentRegistry
    function nameOf(uint256 tokenId) external view returns (string memory) {
        return _names[tokenId];
    }

    /// @inheritdoc IAgentRegistry
    function tokenIdOf(string calldata name) external view returns (uint256) {
        uint256 stored = _claimedBy[keccak256(bytes(name))];
        return stored == 0 ? type(uint256).max : stored - 1;
    }

    /// @inheritdoc IAgentRegistry
    function isClaimed(string calldata name) external view returns (bool) {
        return _claimedBy[keccak256(bytes(name))] != 0;
    }

    function _validateChars(bytes memory nameBytes) internal pure {
        uint256 len = nameBytes.length;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = nameBytes[i];
            bool ok =
                (c >= 0x30 && c <= 0x39) || // 0-9
                (c >= 0x41 && c <= 0x5A) || // A-Z
                (c >= 0x61 && c <= 0x7A) || // a-z
                c == 0x2D ||                // -
                c == 0x5F ||                // _
                c == 0x20;                  // space
            if (!ok) revert InvalidNameCharacter(i, c);
        }
    }
}
