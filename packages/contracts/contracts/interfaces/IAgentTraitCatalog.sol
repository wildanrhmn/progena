// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAgentTraitCatalog {
    event TraitsPublished(uint256 indexed tokenId, address indexed publisher, string traitsJson);

    function publish(uint256 tokenId, string calldata traitsJson) external;

    function traitsOf(uint256 tokenId) external view returns (string memory);

    function isPublished(uint256 tokenId) external view returns (bool);
}
