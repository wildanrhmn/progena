// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IRoyaltySplitter} from "./interfaces/IRoyaltySplitter.sol";
import {IBreedingContract} from "./interfaces/IBreedingContract.sol";

/// @title BreedingContract
/// @notice Sole authorized minter for offspring INFTs in the Progena
///         registry. Charges stud fees, escrows nothing, and forwards
///         fees through the royalty splitter so each parent's owner is
///         paid (and their ancestors get cascading royalties).
/// @dev    Must be set as `breedingContract` on {AgentGenome} for
///         {breed} to succeed. The AgentGenome contract verifies parent
///         existence, distinctness, and finalization on every call.
contract BreedingContract is Ownable, ReentrancyGuard, IBreedingContract {
    IAgentGenome public immutable agentGenome;
    IRoyaltySplitter public immutable royaltySplitter;

    mapping(uint256 => uint256) private _studFees;

    error NotAgentOwner(uint256 tokenId);
    error InsufficientFee(uint256 required, uint256 sent);
    error RefundFailed();

    constructor(
        address initialOwner,
        IAgentGenome agentGenome_,
        IRoyaltySplitter royaltySplitter_
    ) Ownable(initialOwner) {
        agentGenome = agentGenome_;
        royaltySplitter = royaltySplitter_;
    }

    /// @inheritdoc IBreedingContract
    function setStudFee(uint256 tokenId, uint256 fee) external {
        if (agentGenome.ownerOf(tokenId) != msg.sender) revert NotAgentOwner(tokenId);
        _studFees[tokenId] = fee;
        emit StudFeeUpdated(tokenId, fee);
    }

    /// @inheritdoc IBreedingContract
    function studFeeOf(uint256 tokenId) external view returns (uint256) {
        return _studFees[tokenId];
    }

    /// @inheritdoc IBreedingContract
    function quoteBreedingFee(address breeder, uint256 parentA, uint256 parentB)
        external
        view
        returns (uint256)
    {
        return _feeFor(breeder, parentA) + _feeFor(breeder, parentB);
    }

    /// @inheritdoc IBreedingContract
    function breed(uint256 parentA, uint256 parentB)
        external
        payable
        nonReentrant
        returns (uint256 childTokenId)
    {
        uint256 feeA = _feeFor(msg.sender, parentA);
        uint256 feeB = _feeFor(msg.sender, parentB);
        uint256 totalFee = feeA + feeB;

        if (msg.value < totalFee) revert InsufficientFee(totalFee, msg.value);

        childTokenId = agentGenome.mintFromBreeding(msg.sender, parentA, parentB);

        if (feeA > 0) {
            royaltySplitter.distribute{value: feeA}(parentA);
        }
        if (feeB > 0) {
            royaltySplitter.distribute{value: feeB}(parentB);
        }

        uint256 refund = msg.value - totalFee;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            if (!ok) revert RefundFailed();
        }

        emit BreedingExecuted(childTokenId, msg.sender, parentA, parentB, totalFee);
    }

    function _feeFor(address breeder, uint256 tokenId) internal view returns (uint256) {
        if (agentGenome.ownerOf(tokenId) == breeder) return 0;
        return _studFees[tokenId];
    }
}
