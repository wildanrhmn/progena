// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentGenome} from "./interfaces/IAgentGenome.sol";
import {IRoyaltySplitter} from "./interfaces/IRoyaltySplitter.sol";

/// @title RoyaltySplitter
/// @notice Walks an agent's on-chain ancestry and credits each generation
///         a configurable share of the incoming payment. Beneficiaries
///         pull their funds via {withdraw}.
contract RoyaltySplitter is Ownable, ReentrancyGuard, IRoyaltySplitter {
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_LEVEL_SHARE_BPS = 9_500;
    uint8 public constant ABSOLUTE_MAX_DEPTH = 6;

    IAgentGenome public immutable agentGenome;

    uint16 private _levelShareBps;
    uint8 private _maxDepth;

    mapping(address => uint256) private _pending;

    error InvalidShareBps();
    error InvalidMaxDepth();
    error NoFundsToDistribute();
    error NoBalance();
    error TransferFailed();

    constructor(
        address initialOwner,
        IAgentGenome agentGenome_,
        uint16 initialLevelShareBps,
        uint8 initialMaxDepth
    ) Ownable(initialOwner) {
        agentGenome = agentGenome_;
        _setParameters(initialLevelShareBps, initialMaxDepth);
    }

    /// @notice Update the per-level share and max ancestry depth.
    function setParameters(uint16 newLevelShareBps, uint8 newMaxDepth) external onlyOwner {
        _setParameters(newLevelShareBps, newMaxDepth);
    }

    /// @inheritdoc IRoyaltySplitter
    function distribute(uint256 tokenId) external payable nonReentrant {
        if (msg.value == 0) revert NoFundsToDistribute();
        agentGenome.agentOf(tokenId);

        uint256 remaining = msg.value;
        uint16 share = _levelShareBps;
        uint8 depthCap = _maxDepth;

        uint256[] memory currentLevel = new uint256[](1);
        currentLevel[0] = tokenId;

        uint8 levelsWalked;

        for (uint8 d = 0; d < depthCap; d++) {
            if (currentLevel.length == 0 || remaining == 0) break;

            uint256 levelAmount = (remaining * share) / BPS_DENOMINATOR;
            uint256 perAgent = levelAmount / currentLevel.length;
            if (perAgent == 0) break;
            uint256 actualLevelAmount = perAgent * currentLevel.length;

            uint256 nextSize;
            for (uint256 i = 0; i < currentLevel.length; i++) {
                (uint256 pA, uint256 pB) = agentGenome.parentsOf(currentLevel[i]);
                if (pA != 0) nextSize++;
                if (pB != 0) nextSize++;
            }

            uint256[] memory nextLevel = new uint256[](nextSize);
            uint256 nextIdx;

            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentTokenId = currentLevel[i];
                address recipient = agentGenome.ownerOf(currentTokenId);
                _pending[recipient] += perAgent;
                emit ShareCredited(recipient, currentTokenId, perAgent);

                (uint256 pA, uint256 pB) = agentGenome.parentsOf(currentTokenId);
                if (pA != 0) {
                    nextLevel[nextIdx++] = pA;
                }
                if (pB != 0) {
                    nextLevel[nextIdx++] = pB;
                }
            }

            remaining -= actualLevelAmount;
            currentLevel = nextLevel;
            levelsWalked++;
        }

        if (remaining > 0) {
            address earner = agentGenome.ownerOf(tokenId);
            _pending[earner] += remaining;
            emit ShareCredited(earner, tokenId, remaining);
        }

        emit Distributed(tokenId, msg.value, levelsWalked);
    }

    /// @inheritdoc IRoyaltySplitter
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = _pending[msg.sender];
        if (amount == 0) revert NoBalance();
        _pending[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /// @inheritdoc IRoyaltySplitter
    function pendingOf(address beneficiary) external view returns (uint256) {
        return _pending[beneficiary];
    }

    /// @inheritdoc IRoyaltySplitter
    function levelShareBps() external view returns (uint16) {
        return _levelShareBps;
    }

    /// @inheritdoc IRoyaltySplitter
    function maxDepth() external view returns (uint8) {
        return _maxDepth;
    }

    function _setParameters(uint16 newLevelShareBps, uint8 newMaxDepth) internal {
        if (newLevelShareBps == 0 || newLevelShareBps > MAX_LEVEL_SHARE_BPS) revert InvalidShareBps();
        if (newMaxDepth == 0 || newMaxDepth > ABSOLUTE_MAX_DEPTH) revert InvalidMaxDepth();
        _levelShareBps = newLevelShareBps;
        _maxDepth = newMaxDepth;
        emit ParametersUpdated(newLevelShareBps, newMaxDepth);
    }
}
