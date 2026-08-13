// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Circle} from "./Circle.sol";

/// @title CircleFactory
/// @notice Deploys Circle instances. The factory holds no funds and no
/// per-circle state — each Circle is fully self-contained and isolated
/// from every other one.
contract CircleFactory {
    event CircleDeployed(address indexed circle, address indexed creator);

    /// @notice Deploy a new circle.
    /// @param inviteHash keccak256 of the invite secret; participants join with the secret itself.
    function create(
        address token,
        uint256 contribution,
        uint8 memberCount,
        uint32 roundDuration,
        uint64 fillDeadline,
        bytes32 inviteHash
    ) external returns (Circle circle) {
        circle = new Circle(token, contribution, memberCount, roundDuration, fillDeadline, inviteHash);
        emit CircleDeployed(address(circle), msg.sender);
    }
}
