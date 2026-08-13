// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";
import {CircleFactory} from "../src/CircleFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract CircleFactoryTest is Test {
    CircleFactory factory;
    MockERC20 token;

    uint256 constant CONTRIBUTION = 100e18;
    uint8 constant MEMBER_COUNT = 3;
    uint32 constant ROUND_DURATION = 30 days;
    bytes32 constant SECRET = keccak256("cherga-test-secret");
    bytes32 constant INVITE_HASH = keccak256(abi.encodePacked(SECRET));
    uint64 fillDeadline;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        factory = new CircleFactory();
        token = new MockERC20();
        fillDeadline = uint64(block.timestamp + 7 days);
    }

    function _create() internal returns (Circle) {
        return factory.create(address(token), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    // --- create(): allowed ---

    function test_create_deploysCircleWithGivenParameters() public {
        Circle circle = _create();

        assertEq(circle.token(), address(token));
        assertEq(circle.contribution(), CONTRIBUTION);
        assertEq(circle.memberCount(), MEMBER_COUNT);
        assertEq(circle.roundDuration(), ROUND_DURATION);
        assertEq(circle.fillDeadline(), fillDeadline);
        assertEq(circle.inviteHash(), INVITE_HASH);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function test_create_emitsCircleDeployed() public {
        // The circle's address isn't known before the call, so we can't
        // pre-write an `emit` to match against — record raw logs instead
        // and decode the indexed topics by hand.
        vm.recordLogs();
        Circle circle = _create();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory deployedLog = logs[logs.length - 1];

        assertEq(deployedLog.topics[0], keccak256("CircleDeployed(address,address)"));
        assertEq(address(uint160(uint256(deployedLog.topics[1]))), address(circle));
        assertEq(address(uint160(uint256(deployedLog.topics[2]))), address(this));
    }

    // --- isolation ---

    function test_isolation_twoCirclesDoNotShareFundsOrMembership() public {
        Circle circleA = _create();
        Circle circleB = _create();

        assertTrue(address(circleA) != address(circleB));

        vm.prank(alice);
        circleA.join(SECRET);

        assertTrue(circleA.isMember(alice));
        assertFalse(circleB.isMember(alice));

        // fill and fund circle A only
        vm.prank(bob);
        circleA.join(SECRET);
        vm.prank(makeAddr("carolA"));
        circleA.join(SECRET);

        token.mint(bob, CONTRIBUTION);
        vm.prank(bob);
        token.approve(address(circleA), CONTRIBUTION);
        vm.prank(bob);
        circleA.contribute();

        assertEq(token.balanceOf(address(circleA)), CONTRIBUTION);
        assertEq(token.balanceOf(address(circleB)), 0);
        assertEq(uint8(circleB.state()), uint8(Circle.State.Forming));
    }
}
