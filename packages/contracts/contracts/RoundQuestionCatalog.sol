// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPredictionRound} from "./interfaces/IPredictionRound.sol";
import {IRoundQuestionCatalog} from "./interfaces/IRoundQuestionCatalog.sol";

/// @title RoundQuestionCatalog
/// @notice Permissionless on-chain registry of plain-text question strings for
///         PredictionRound rounds. Anyone may publish a text iff its
///         keccak256 matches the round's stored questionHash. Once set,
///         the text is immutable. Trustless and self-verifying — no operator
///         intervention, no off-chain catalog drift.
contract RoundQuestionCatalog is IRoundQuestionCatalog {
    IPredictionRound public immutable predictionRound;

    mapping(uint256 => string) private _texts;

    error HashMismatch(bytes32 supplied, bytes32 expected);
    error AlreadyPublished(uint256 roundId);
    error EmptyText();

    constructor(IPredictionRound predictionRound_) {
        predictionRound = predictionRound_;
    }

    /// @inheritdoc IRoundQuestionCatalog
    function publish(uint256 roundId, string calldata text) external {
        if (bytes(text).length == 0) revert EmptyText();
        if (bytes(_texts[roundId]).length != 0) revert AlreadyPublished(roundId);

        IPredictionRound.RoundData memory r = predictionRound.roundOf(roundId);
        bytes32 supplied = keccak256(bytes(text));
        if (supplied != r.questionHash) revert HashMismatch(supplied, r.questionHash);

        _texts[roundId] = text;
        emit QuestionPublished(roundId, msg.sender, text);
    }

    /// @inheritdoc IRoundQuestionCatalog
    function textOf(uint256 roundId) external view returns (string memory) {
        return _texts[roundId];
    }

    /// @inheritdoc IRoundQuestionCatalog
    function isPublished(uint256 roundId) external view returns (bool) {
        return bytes(_texts[roundId]).length != 0;
    }
}
