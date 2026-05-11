// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRoundMetadata {
    event QuestionPublished(uint256 indexed roundId, address indexed publisher, string text);

    function publishQuestion(uint256 roundId, string calldata text) external;
    function questionOf(uint256 roundId) external view returns (string memory);
    function isQuestionPublished(uint256 roundId) external view returns (bool);
}
