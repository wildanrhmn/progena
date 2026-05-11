// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IAgentTraitCatalog} from "./interfaces/IAgentTraitCatalog.sol";

/// @title AgentTraitCatalog
/// @notice On-chain registry of public, non-secret trait JSON per AgentGenome
///         token. Only the current owner of an agent can publish or update
///         its trait blob. Lets the frontend show what an agent IS (skills,
///         tools, SOUL preview, description) without exposing the encrypted
///         genome shards on 0G Storage.
contract AgentTraitCatalog is IAgentTraitCatalog {
    IAgentGenome public immutable agentGenome;

    uint256 public constant MAX_TRAITS_LENGTH = 8192;

    mapping(uint256 => string) private _traits;

    error NotTokenOwner(uint256 tokenId, address caller);
    error EmptyTraits();
    error TraitsTooLong(uint256 length);

    constructor(IAgentGenome agentGenome_) {
        agentGenome = agentGenome_;
    }

    /// @inheritdoc IAgentTraitCatalog
    function publish(uint256 tokenId, string calldata traitsJson) external {
        if (agentGenome.ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }
        uint256 len = bytes(traitsJson).length;
        if (len == 0) revert EmptyTraits();
        if (len > MAX_TRAITS_LENGTH) revert TraitsTooLong(len);

        _traits[tokenId] = traitsJson;
        emit TraitsPublished(tokenId, msg.sender, traitsJson);
    }

    /// @inheritdoc IAgentTraitCatalog
    function traitsOf(uint256 tokenId) external view returns (string memory) {
        return _traits[tokenId];
    }

    /// @inheritdoc IAgentTraitCatalog
    function isPublished(uint256 tokenId) external view returns (bool) {
        return bytes(_traits[tokenId]).length != 0;
    }
}
