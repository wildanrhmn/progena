// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAgentMetadata {
    struct EarnedSkill {
        uint256 tokenId;
        string skillName;
        bytes32 skillRootHash;
        uint256 earnedInRound;
        uint64 earnedAt;
        address attestor;
        string reasoning;
    }

    event NameClaimed(uint256 indexed tokenId, address indexed owner, string name);
    event TraitsPublished(uint256 indexed tokenId, address indexed publisher, string traitsJson);
    event SkillEarned(
        uint256 indexed tokenId,
        string skillName,
        bytes32 skillRootHash,
        uint256 indexed earnedInRound,
        address indexed attestor,
        string reasoning
    );
    event OperatorChanged(address indexed previousOperator, address indexed newOperator);

    // --- Names (owner-set, set-once) ---
    function setName(uint256 tokenId, string calldata name) external;
    function nameOf(uint256 tokenId) external view returns (string memory);
    function hasName(uint256 tokenId) external view returns (bool);

    // --- Traits (owner-publish, updateable) ---
    function publishTraits(uint256 tokenId, string calldata traitsJson) external;
    function traitsOf(uint256 tokenId) external view returns (string memory);
    function isTraitsPublished(uint256 tokenId) external view returns (bool);

    // --- Earned skills (operator-attested, append-only per (tokenId, name)) ---
    function recordEarnedSkill(
        uint256 tokenId,
        string calldata skillName,
        bytes32 skillRootHash,
        uint256 earnedInRound,
        string calldata reasoning
    ) external;
    function earnedCountOf(uint256 tokenId) external view returns (uint256);
    function earnedAt(uint256 tokenId, uint256 index) external view returns (EarnedSkill memory);
    function earnedSkillsOf(uint256 tokenId) external view returns (EarnedSkill[] memory);
    function hasEarnedSkill(uint256 tokenId, string calldata skillName) external view returns (bool);

    // --- Operator rotation ---
    function operator() external view returns (address);
    function setOperator(address newOperator) external;
}
