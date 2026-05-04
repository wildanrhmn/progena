// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAgentGenome
/// @notice INFT registry interface for Progena agents.
/// @dev Each token is an autonomous agent. Its `rootHash` points to an
///      ECIES-encrypted OpenClaw workspace bundle stored on 0G Storage.
///      Bred agents are minted with a placeholder root hash; the real
///      hash is set later by the off-chain genome writer once the
///      workspace has been computed and uploaded.
interface IAgentGenome {
    /// @notice Snapshot of an agent's lineage and storage pointer.
    /// @param rootHash       0G Storage root hash of the encrypted genome bundle.
    ///                       `bytes32(0)` until the genome is finalized.
    /// @param parentA        Token ID of the first parent. `0` for genesis agents.
    /// @param parentB        Token ID of the second parent. `0` for genesis agents.
    /// @param bornAt         Block timestamp when the token was minted.
    /// @param generation     Distance from the closest genesis ancestor.
    ///                       Genesis = 0; child = max(parentA.gen, parentB.gen) + 1.
    struct AgentData {
        bytes32 rootHash;
        uint256 parentA;
        uint256 parentB;
        uint64 bornAt;
        uint16 generation;
    }

    /// @notice Emitted when a genesis agent (no parents) is minted.
    event GenesisMinted(uint256 indexed tokenId, address indexed to, bytes32 rootHash);

    /// @notice Emitted when an agent is minted as the offspring of two parents.
    /// @dev Off-chain workers listen to this to compute the child genome,
    ///      upload it to 0G Storage, and call {setRootHash} to finalize.
    event Bred(
        uint256 indexed tokenId,
        uint256 indexed parentA,
        uint256 indexed parentB,
        address to,
        uint16 generation
    );

    /// @notice Emitted when the genome root hash for a token is finalized.
    event RootHashSet(uint256 indexed tokenId, bytes32 rootHash);

    /// @notice Emitted when the breeding contract address is updated.
    event BreedingContractUpdated(address indexed breedingContract);

    /// @notice Emitted when the genome writer address is updated.
    event GenomeWriterUpdated(address indexed genomeWriter);

    /// @notice Mint a brand-new agent with no on-chain ancestry.
    /// @dev Restricted to the registry owner. Used to seed the protocol with
    ///      foundational agents before public breeding opens.
    /// @param to        Recipient of the INFT.
    /// @param rootHash  Genome pointer; must be non-zero.
    /// @return tokenId  ID of the newly minted agent.
    function mintGenesis(address to, bytes32 rootHash) external returns (uint256 tokenId);

    /// @notice Mint an agent as the offspring of two existing agents.
    /// @dev Restricted to the configured breeding contract. The new token's
    ///      root hash is initialized to `bytes32(0)` and must be set later
    ///      via {setRootHash}.
    /// @param to       Recipient of the INFT.
    /// @param parentA  Token ID of the first parent.
    /// @param parentB  Token ID of the second parent. Must differ from `parentA`.
    /// @return tokenId ID of the newly minted child.
    function mintFromBreeding(address to, uint256 parentA, uint256 parentB)
        external
        returns (uint256 tokenId);

    /// @notice Finalize an agent's genome by writing its 0G Storage root hash.
    /// @dev Restricted to the configured genome writer. Can only be called
    ///      once per token (when `rootHash` is currently zero).
    function setRootHash(uint256 tokenId, bytes32 rootHash) external;

    /// @notice Returns the full {AgentData} struct for a token.
    function agentOf(uint256 tokenId) external view returns (AgentData memory);

    /// @notice Returns the two parent token IDs of an agent.
    function parentsOf(uint256 tokenId) external view returns (uint256 parentA, uint256 parentB);

    /// @notice Returns the generation depth of an agent.
    function generationOf(uint256 tokenId) external view returns (uint16);

    /// @notice Returns the 0G Storage root hash for an agent's genome.
    function rootHashOf(uint256 tokenId) external view returns (bytes32);

    /// @notice True if the agent has no on-chain parents.
    function isGenesisAgent(uint256 tokenId) external view returns (bool);

    /// @notice True if the agent's genome has been finalized (root hash set).
    function isFinalized(uint256 tokenId) external view returns (bool);
}
