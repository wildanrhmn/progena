// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IBreedingContract
/// @notice User-facing breeding entry point. Pairs two agents, mints a child
///         INFT through {IAgentGenome.mintFromBreeding}, and routes any stud
///         fees through {IRoyaltySplitter.distribute} so parent owners earn
///         royalties (with their own ancestors getting a cascading share).
/// @dev    Stud fees are set per-agent by the agent's current owner. If the
///         breeder owns a parent, no stud fee is charged for that parent.
///         The breeder may overpay; the surplus is refunded.
interface IBreedingContract {
    /// @notice Emitted when an agent owner updates their stud fee.
    event StudFeeUpdated(uint256 indexed tokenId, uint256 fee);

    /// @notice Emitted on a successful breed.
    event BreedingExecuted(
        uint256 indexed childTokenId,
        address indexed breeder,
        uint256 indexed parentA,
        uint256 parentB,
        uint256 totalFeesPaid
    );

    /// @notice Set or update the stud fee for an agent. Callable only by
    ///         the agent's current owner.
    function setStudFee(uint256 tokenId, uint256 fee) external;

    /// @notice Returns the stud fee for an agent (0 if not set).
    function studFeeOf(uint256 tokenId) external view returns (uint256);

    /// @notice Quote the total fee a given breeder would pay to mate two parents.
    /// @dev    Stud fees for parents the breeder already owns are excluded.
    function quoteBreedingFee(address breeder, uint256 parentA, uint256 parentB)
        external
        view
        returns (uint256);

    /// @notice Breed two parents. Mints a child INFT to `msg.sender`, routes
    ///         stud fees through the royalty splitter, refunds any surplus.
    /// @param parentA First parent token id.
    /// @param parentB Second parent token id; must differ from `parentA`.
    /// @return childTokenId The newly minted child agent's token id.
    function breed(uint256 parentA, uint256 parentB)
        external
        payable
        returns (uint256 childTokenId);
}
