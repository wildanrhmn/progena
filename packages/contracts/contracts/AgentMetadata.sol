// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IAgentMetadata} from "./interfaces/IAgentMetadata.sol";

/// @title AgentMetadata
/// @notice Unified upgradeable on-chain registry for everything *about* an
///         AgentGenome token that isn't the genome itself: claim-once names,
///         owner-published trait JSON, and daemon-attested earned skills.
///         Consolidates AgentRegistry + AgentTraitCatalog + AgentSkillExtensions
///         into a single UUPS-upgradeable surface so future agent-level fields
///         ship as upgrades instead of new satellite contracts.
/// @dev    Storage layout is append-only across upgrades. `_gap` reserves
///         150 slots for future fields. Never reorder or repurpose existing
///         slots — only append.
contract AgentMetadata is
    IAgentMetadata,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // --- Limits ---
    uint256 public constant MAX_NAME_LENGTH = 32;
    uint256 public constant MAX_TRAITS_LENGTH = 8192;
    uint256 public constant MAX_SKILL_NAME_LENGTH = 64;
    uint256 public constant MAX_REASONING_LENGTH = 512;

    // --- v1 storage (do not reorder) ---
    IAgentGenome public agentGenome;
    address public operator;

    mapping(uint256 => string) private _names;
    mapping(uint256 => string) private _traits;
    mapping(uint256 => EarnedSkill[]) private _earned;
    mapping(uint256 => mapping(string => bool)) private _hasEarnedSkill;

    /// @dev Reserved for future fields. Decrement when adding storage so total
    ///      slots used by this contract stays constant. Length intentionally
    ///      generous (150) to give plenty of headroom.
    uint256[150] private __gap;

    // --- Errors ---
    error NotTokenOwner(uint256 tokenId, address caller);
    error NameAlreadyClaimed(uint256 tokenId);
    error NameTooLong(uint256 length);
    error EmptyName();
    error EmptyTraits();
    error TraitsTooLong(uint256 length);
    error NotOperator(address caller);
    error EmptySkillName();
    error SkillNameTooLong(uint256 length);
    error EmptyRootHash();
    error ReasoningTooLong(uint256 length);
    error SkillAlreadyEarned(uint256 tokenId, string skillName);
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, IAgentGenome agentGenome_, address operator_)
        external
        initializer
    {
        if (owner_ == address(0)) revert ZeroAddress();
        if (address(agentGenome_) == address(0)) revert ZeroAddress();
        if (operator_ == address(0)) revert ZeroAddress();

        __Ownable_init(owner_);

        agentGenome = agentGenome_;
        operator = operator_;
        emit OperatorChanged(address(0), operator_);
    }

    // --- Names ---

    /// @inheritdoc IAgentMetadata
    function setName(uint256 tokenId, string calldata name) external {
        if (agentGenome.ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }
        if (bytes(_names[tokenId]).length != 0) {
            revert NameAlreadyClaimed(tokenId);
        }
        uint256 len = bytes(name).length;
        if (len == 0) revert EmptyName();
        if (len > MAX_NAME_LENGTH) revert NameTooLong(len);

        _names[tokenId] = name;
        emit NameClaimed(tokenId, msg.sender, name);
    }

    /// @inheritdoc IAgentMetadata
    function nameOf(uint256 tokenId) external view returns (string memory) {
        return _names[tokenId];
    }

    /// @inheritdoc IAgentMetadata
    function hasName(uint256 tokenId) external view returns (bool) {
        return bytes(_names[tokenId]).length != 0;
    }

    // --- Traits ---

    /// @inheritdoc IAgentMetadata
    function publishTraits(uint256 tokenId, string calldata traitsJson) external {
        if (agentGenome.ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }
        uint256 len = bytes(traitsJson).length;
        if (len == 0) revert EmptyTraits();
        if (len > MAX_TRAITS_LENGTH) revert TraitsTooLong(len);

        _traits[tokenId] = traitsJson;
        emit TraitsPublished(tokenId, msg.sender, traitsJson);
    }

    /// @inheritdoc IAgentMetadata
    function traitsOf(uint256 tokenId) external view returns (string memory) {
        return _traits[tokenId];
    }

    /// @inheritdoc IAgentMetadata
    function isTraitsPublished(uint256 tokenId) external view returns (bool) {
        return bytes(_traits[tokenId]).length != 0;
    }

    // --- Earned skills ---

    /// @inheritdoc IAgentMetadata
    function recordEarnedSkill(
        uint256 tokenId,
        string calldata skillName,
        bytes32 skillRootHash,
        uint256 earnedInRound,
        string calldata reasoning
    ) external {
        if (msg.sender != operator) revert NotOperator(msg.sender);

        uint256 nameLen = bytes(skillName).length;
        if (nameLen == 0) revert EmptySkillName();
        if (nameLen > MAX_SKILL_NAME_LENGTH) revert SkillNameTooLong(nameLen);
        if (skillRootHash == bytes32(0)) revert EmptyRootHash();

        uint256 reasoningLen = bytes(reasoning).length;
        if (reasoningLen > MAX_REASONING_LENGTH) revert ReasoningTooLong(reasoningLen);

        if (_hasEarnedSkill[tokenId][skillName]) {
            revert SkillAlreadyEarned(tokenId, skillName);
        }

        _hasEarnedSkill[tokenId][skillName] = true;
        _earned[tokenId].push(
            EarnedSkill({
                tokenId: tokenId,
                skillName: skillName,
                skillRootHash: skillRootHash,
                earnedInRound: earnedInRound,
                earnedAt: uint64(block.timestamp),
                attestor: msg.sender,
                reasoning: reasoning
            })
        );

        emit SkillEarned(tokenId, skillName, skillRootHash, earnedInRound, msg.sender, reasoning);
    }

    /// @inheritdoc IAgentMetadata
    function earnedCountOf(uint256 tokenId) external view returns (uint256) {
        return _earned[tokenId].length;
    }

    /// @inheritdoc IAgentMetadata
    function earnedAt(uint256 tokenId, uint256 index)
        external
        view
        returns (EarnedSkill memory)
    {
        return _earned[tokenId][index];
    }

    /// @inheritdoc IAgentMetadata
    function earnedSkillsOf(uint256 tokenId)
        external
        view
        returns (EarnedSkill[] memory)
    {
        return _earned[tokenId];
    }

    /// @inheritdoc IAgentMetadata
    function hasEarnedSkill(uint256 tokenId, string calldata skillName)
        external
        view
        returns (bool)
    {
        return _hasEarnedSkill[tokenId][skillName];
    }

    // --- Operator rotation (governance-controlled) ---

    /// @inheritdoc IAgentMetadata
    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        address prev = operator;
        operator = newOperator;
        emit OperatorChanged(prev, newOperator);
    }

    // --- UUPS ---

    /// @dev Only the contract owner can authorize upgrades.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
