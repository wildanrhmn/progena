// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";

/// @title AgentGenome
/// @notice INFT registry for Progena agents. Each token represents an
///         autonomous AI agent whose encrypted OpenClaw workspace lives
///         on 0G Storage at `rootHash`.
/// @dev    Two privileged roles, settable by the owner:
///           - `breedingContract`: only address allowed to mint via
///             {mintFromBreeding}. Set to the deployed BreedingContract.
///           - `genomeWriter`: only address allowed to finalize a child
///             agent's root hash via {setRootHash}. Set to the trusted
///             off-chain orchestrator (and later, ideally, to a multisig
///             or governance contract).
contract AgentGenome is ERC721, Ownable, IAgentGenome {
    using Strings for uint256;

    uint256 private _nextTokenId;
    string private _baseTokenURI;

    address public breedingContract;
    address public genomeWriter;

    mapping(uint256 => AgentData) private _agents;

    error NotBreedingContract();
    error NotGenomeWriter();
    error AgentDoesNotExist(uint256 tokenId);
    error ParentDoesNotExist(uint256 tokenId);
    error ParentNotFinalized(uint256 tokenId);
    error IdenticalParents();
    error RootHashAlreadySet(uint256 tokenId);
    error InvalidRootHash();

    modifier onlyBreedingContract() {
        if (msg.sender != breedingContract) revert NotBreedingContract();
        _;
    }

    modifier onlyGenomeWriter() {
        if (msg.sender != genomeWriter) revert NotGenomeWriter();
        _;
    }

    constructor(address initialOwner, string memory baseURI_)
        ERC721("Progena Agent", "PRGN")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI_;
        _nextTokenId = 1;
    }

    /// @notice Set the contract authorized to mint via {mintFromBreeding}.
    function setBreedingContract(address newBreedingContract) external onlyOwner {
        breedingContract = newBreedingContract;
        emit BreedingContractUpdated(newBreedingContract);
    }

    /// @notice Set the address authorized to call {setRootHash}.
    function setGenomeWriter(address newGenomeWriter) external onlyOwner {
        genomeWriter = newGenomeWriter;
        emit GenomeWriterUpdated(newGenomeWriter);
    }

    /// @notice Update the metadata base URI.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    /// @inheritdoc IAgentGenome
    function mintGenesis(address to, bytes32 rootHash)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        if (rootHash == bytes32(0)) revert InvalidRootHash();

        tokenId = _nextTokenId++;
        _agents[tokenId] = AgentData({
            rootHash: rootHash,
            parentA: 0,
            parentB: 0,
            bornAt: uint64(block.timestamp),
            generation: 0
        });

        _safeMint(to, tokenId);
        emit GenesisMinted(tokenId, to, rootHash);
    }

    /// @inheritdoc IAgentGenome
    function mintFromBreeding(address to, uint256 parentA, uint256 parentB)
        external
        onlyBreedingContract
        returns (uint256 tokenId)
    {
        if (parentA == parentB) revert IdenticalParents();
        if (!_agentExists(parentA)) revert ParentDoesNotExist(parentA);
        if (!_agentExists(parentB)) revert ParentDoesNotExist(parentB);
        if (_agents[parentA].rootHash == bytes32(0)) revert ParentNotFinalized(parentA);
        if (_agents[parentB].rootHash == bytes32(0)) revert ParentNotFinalized(parentB);

        tokenId = _nextTokenId++;
        uint16 childGeneration = _maxGen(
            _agents[parentA].generation,
            _agents[parentB].generation
        ) + 1;

        _agents[tokenId] = AgentData({
            rootHash: bytes32(0),
            parentA: parentA,
            parentB: parentB,
            bornAt: uint64(block.timestamp),
            generation: childGeneration
        });

        _safeMint(to, tokenId);
        emit Bred(tokenId, parentA, parentB, to, childGeneration);
    }

    /// @inheritdoc IAgentGenome
    function setRootHash(uint256 tokenId, bytes32 rootHash) external onlyGenomeWriter {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        if (rootHash == bytes32(0)) revert InvalidRootHash();
        if (_agents[tokenId].rootHash != bytes32(0)) revert RootHashAlreadySet(tokenId);

        _agents[tokenId].rootHash = rootHash;
        emit RootHashSet(tokenId, rootHash);
    }

    /// @inheritdoc IAgentGenome
    function agentOf(uint256 tokenId) external view returns (AgentData memory) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        return _agents[tokenId];
    }

    /// @inheritdoc IAgentGenome
    function parentsOf(uint256 tokenId)
        external
        view
        returns (uint256 parentA, uint256 parentB)
    {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        AgentData storage data = _agents[tokenId];
        return (data.parentA, data.parentB);
    }

    /// @inheritdoc IAgentGenome
    function generationOf(uint256 tokenId) external view returns (uint16) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        return _agents[tokenId].generation;
    }

    /// @inheritdoc IAgentGenome
    function rootHashOf(uint256 tokenId) external view returns (bytes32) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        return _agents[tokenId].rootHash;
    }

    /// @inheritdoc IAgentGenome
    function isGenesisAgent(uint256 tokenId) external view returns (bool) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        AgentData storage data = _agents[tokenId];
        return data.parentA == 0 && data.parentB == 0;
    }

    /// @inheritdoc IAgentGenome
    function isFinalized(uint256 tokenId) external view returns (bool) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        return _agents[tokenId].rootHash != bytes32(0);
    }

    /// @notice Total number of agents minted to date.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_agentExists(tokenId)) revert AgentDoesNotExist(tokenId);
        return string.concat(_baseTokenURI, tokenId.toString());
    }

    function _agentExists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _maxGen(uint16 a, uint16 b) internal pure returns (uint16) {
        return a >= b ? a : b;
    }
}
