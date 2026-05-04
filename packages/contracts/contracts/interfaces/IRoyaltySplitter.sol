// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IRoyaltySplitter
/// @notice Pull-payment royalty distribution that walks an agent's ancestry.
/// @dev When an earner agent receives a payment via {distribute}, the funds
///      flow up its lineage. At each generation, `levelShareBps` of the
///      remaining amount is divided evenly across that generation's agents;
///      the remainder cascades up to their parents. Dust and any amount
///      beyond `maxDepth` is credited back to the original earner.
///
///      Same-ancestor-multiple-times (inbreeding) is intentional: an agent
///      that appears N times in the ancestry receives N shares.
interface IRoyaltySplitter {
    /// @notice Emitted once per distribute() call.
    event Distributed(uint256 indexed tokenId, uint256 amount, uint8 levelsWalked);

    /// @notice Emitted for every per-agent credit, including dust returned to the earner.
    event ShareCredited(address indexed beneficiary, uint256 indexed tokenId, uint256 amount);

    /// @notice Emitted when a beneficiary withdraws their accumulated balance.
    event Withdrawn(address indexed beneficiary, uint256 amount);

    /// @notice Emitted when the royalty parameters are updated.
    event ParametersUpdated(uint16 levelShareBps, uint8 maxDepth);

    /// @notice Distribute `msg.value` through the ancestry of `tokenId`.
    function distribute(uint256 tokenId) external payable;

    /// @notice Withdraw all accumulated balance for `msg.sender`.
    /// @return amount The amount transferred.
    function withdraw() external returns (uint256 amount);

    /// @notice Currently accumulated balance for a beneficiary.
    function pendingOf(address beneficiary) external view returns (uint256);

    /// @notice Basis points of the remaining amount distributed at each generation.
    function levelShareBps() external view returns (uint16);

    /// @notice Maximum number of generations to walk before sending the remainder to the earner.
    function maxDepth() external view returns (uint8);
}
