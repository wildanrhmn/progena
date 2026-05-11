// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRoundQuestionCatalog {
    event QuestionPublished(uint256 indexed roundId, address indexed publisher, string text);

    function publish(uint256 roundId, string calldata text) external;

    function textOf(uint256 roundId) external view returns (string memory);

    function isPublished(uint256 roundId) external view returns (bool);
}
