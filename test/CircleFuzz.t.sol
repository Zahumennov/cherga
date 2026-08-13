// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Fuzzes Circle's creation parameters (N, C, round duration) across
/// wide ranges, as opposed to Circle.t.sol's fixed example values for the
/// same boundary checks.
contract CircleFuzzTest is Test {
    MockERC20 token;
    bytes32 constant SECRET = keccak256("cherga-fuzz-secret");
    bytes32 constant INVITE_HASH = keccak256(abi.encodePacked(SECRET));

    function setUp() public {
        token = new MockERC20();
    }

    function testFuzz_constructor_succeedsForValidRanges(
        uint256 contribution,
        uint8 memberCount,
        uint32 roundDuration,
        uint64 fillDeadlineOffset
    ) public {
        contribution = bound(contribution, 1, type(uint256).max);
        memberCount = uint8(bound(memberCount, 2, 20));
        roundDuration = uint32(bound(roundDuration, 1, type(uint32).max));
        fillDeadlineOffset = uint64(bound(fillDeadlineOffset, 1, 365 days));
        uint64 fillDeadline = uint64(block.timestamp) + fillDeadlineOffset;

        Circle circle = new Circle(address(token), contribution, memberCount, roundDuration, fillDeadline, INVITE_HASH);

        assertEq(circle.contribution(), contribution);
        assertEq(circle.memberCount(), memberCount);
        assertEq(circle.roundDuration(), roundDuration);
        assertEq(circle.fillDeadline(), fillDeadline);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function testFuzz_constructor_revertsForMemberCountBelowMin(uint8 memberCount) public {
        memberCount = uint8(bound(memberCount, 0, 1));
        uint64 fillDeadline = uint64(block.timestamp + 7 days);

        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(address(token), 1e18, memberCount, 30 days, fillDeadline, INVITE_HASH);
    }

    function testFuzz_constructor_revertsForMemberCountAboveMax(uint8 memberCount) public {
        memberCount = uint8(bound(memberCount, 21, 255));
        uint64 fillDeadline = uint64(block.timestamp + 7 days);

        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(address(token), 1e18, memberCount, 30 days, fillDeadline, INVITE_HASH);
    }

    function testFuzz_constructor_revertsForPastOrPresentFillDeadline(uint64 fillDeadline) public {
        fillDeadline = uint64(bound(fillDeadline, 0, block.timestamp));

        vm.expectRevert(Circle.FillDeadlineInPast.selector);
        new Circle(address(token), 1e18, 5, 30 days, fillDeadline, INVITE_HASH);
    }
}
