// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IPredictionRound} from "./interfaces/IPredictionRound.sol";
import {IRoundMetadata} from "./interfaces/IRoundMetadata.sol";

/// @title RoundMetadata
/// @notice Unified upgradeable on-chain registry for per-round metadata that
///         doesn't fit in PredictionRound itself. Today: the plain-text
///         question string, validated by hash match. Future: oracle evidence,
///         AI commentary on outcome, etc. — added via UUPS upgrade.
/// @dev    Storage append-only across upgrades. `_gap` reserves 100 slots.
contract RoundMetadata is
    IRoundMetadata,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // --- v1 storage ---
    IPredictionRound public predictionRound;
    mapping(uint256 => string) private _questions;

    uint256[100] private __gap;

    // --- Errors ---
    error HashMismatch(bytes32 supplied, bytes32 expected);
    error AlreadyPublished(uint256 roundId);
    error EmptyText();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_, IPredictionRound predictionRound_)
        external
        initializer
    {
        if (owner_ == address(0)) revert ZeroAddress();
        if (address(predictionRound_) == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        predictionRound = predictionRound_;
    }

    /// @inheritdoc IRoundMetadata
    function publishQuestion(uint256 roundId, string calldata text) external {
        if (bytes(text).length == 0) revert EmptyText();
        if (bytes(_questions[roundId]).length != 0) revert AlreadyPublished(roundId);

        IPredictionRound.RoundData memory r = predictionRound.roundOf(roundId);
        bytes32 supplied = keccak256(bytes(text));
        if (supplied != r.questionHash) revert HashMismatch(supplied, r.questionHash);

        _questions[roundId] = text;
        emit QuestionPublished(roundId, msg.sender, text);
    }

    /// @inheritdoc IRoundMetadata
    function questionOf(uint256 roundId) external view returns (string memory) {
        return _questions[roundId];
    }

    /// @inheritdoc IRoundMetadata
    function isQuestionPublished(uint256 roundId) external view returns (bool) {
        return bytes(_questions[roundId]).length != 0;
    }

    /// @dev Only the contract owner can authorize upgrades.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
