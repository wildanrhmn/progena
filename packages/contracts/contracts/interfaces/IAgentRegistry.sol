// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAgentRegistry
/// @notice Claim-once human-readable name registry for AgentGenome tokens.
/// @dev    Each tokenId may set exactly one name, and each name may be
///         claimed by exactly one tokenId. Names are stored verbatim
///         (case-sensitive); uniqueness is enforced on the literal bytes.
interface IAgentRegistry {
    /// @notice Emitted when a token claims its name.
    event NameSet(uint256 indexed tokenId, string name, address indexed by);

    /// @notice Set the name for `tokenId`. Caller must be the current owner of
    ///         the token, the name must pass validation, and neither the token
    ///         nor the name may have been claimed before.
    function setName(uint256 tokenId, string calldata name) external;

    /// @notice Returns the name claimed by `tokenId`, or the empty string if
    ///         none has been set.
    function nameOf(uint256 tokenId) external view returns (string memory);

    /// @notice Returns the tokenId that claimed `name`, or `type(uint256).max`
    ///         if the name is unclaimed.
    function tokenIdOf(string calldata name) external view returns (uint256);

    /// @notice Whether `name` has already been claimed by some token.
    function isClaimed(string calldata name) external view returns (bool);
}
