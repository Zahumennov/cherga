// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";

contract CircleTest is Test {
    Circle circle;

    address token = makeAddr("token");
    uint256 constant CONTRIBUTION = 100e18;
    uint8 constant MEMBER_COUNT = 3;
    uint32 constant ROUND_DURATION = 30 days;
    uint64 fillDeadline;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    function setUp() public {
        fillDeadline = uint64(block.timestamp + 7 days);
        circle = new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
    }

    function _fillCircle() internal {
        vm.prank(alice);
        circle.join();
        vm.prank(bob);
        circle.join();
        vm.prank(carol);
        circle.join();
    }

    function _cancelCircle() internal {
        vm.warp(fillDeadline);
        circle.cancel();
    }

    // --- constructor: allowed ---

    function test_constructor_setsParametersAndForming() public view {
        assertEq(circle.token(), token);
        assertEq(circle.contribution(), CONTRIBUTION);
        assertEq(circle.memberCount(), MEMBER_COUNT);
        assertEq(circle.roundDuration(), ROUND_DURATION);
        assertEq(circle.fillDeadline(), fillDeadline);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function test_constructor_emitsCircleCreated() public {
        vm.expectEmit(true, true, true, true);
        emit Circle.CircleCreated(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
    }

    // --- constructor: forbidden ---

    function test_constructor_revertsOnZeroAddressToken() public {
        vm.expectRevert(Circle.ZeroAddress.selector);
        new Circle(address(0), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
    }

    function test_constructor_revertsOnZeroContribution() public {
        vm.expectRevert(Circle.ZeroContribution.selector);
        new Circle(token, 0, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
    }

    function test_constructor_revertsOnMemberCountTooLow() public {
        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(token, CONTRIBUTION, 1, ROUND_DURATION, fillDeadline);
    }

    function test_constructor_revertsOnMemberCountTooHigh() public {
        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(token, CONTRIBUTION, 21, ROUND_DURATION, fillDeadline);
    }

    function test_constructor_revertsOnZeroRoundDuration() public {
        vm.expectRevert(Circle.InvalidRoundDuration.selector);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, 0, fillDeadline);
    }

    function test_constructor_revertsOnPastFillDeadline() public {
        vm.expectRevert(Circle.FillDeadlineInPast.selector);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, uint64(block.timestamp));
    }

    // --- join(): allowed ---

    function test_join_addsMemberAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit Circle.MemberJoined(alice, 0);
        vm.prank(alice);
        circle.join();

        assertTrue(circle.isMember(alice));
        assertEq(circle.order(0), alice);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function test_join_activatesOnLastMember() public {
        vm.prank(alice);
        circle.join();
        vm.prank(bob);
        circle.join();

        vm.expectEmit(true, true, true, true);
        emit Circle.CircleActivated(uint64(block.timestamp) + ROUND_DURATION);
        vm.prank(carol);
        circle.join();

        assertEq(uint8(circle.state()), uint8(Circle.State.Active));
        assertEq(circle.currentRound(), 1);
        assertEq(circle.roundEnd(), uint64(block.timestamp) + ROUND_DURATION);
    }

    // --- join(): forbidden ---

    function test_join_revertsWhenNotForming() public {
        _fillCircle();
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Forming, Circle.State.Active));
        vm.prank(dave);
        circle.join();
    }

    function test_join_revertsWhenAlreadyMember() public {
        vm.startPrank(alice);
        circle.join();
        vm.expectRevert(Circle.AlreadyMember.selector);
        circle.join();
        vm.stopPrank();
    }

    function test_join_revertsAfterFillDeadline() public {
        vm.warp(fillDeadline);
        vm.expectRevert(Circle.FillDeadlinePassed.selector);
        vm.prank(alice);
        circle.join();
    }

    // --- cancel(): allowed ---

    function test_cancel_movesToCancelled() public {
        vm.prank(alice);
        circle.join();

        vm.warp(fillDeadline);
        vm.expectEmit(true, true, true, true);
        emit Circle.CircleCancelled();
        circle.cancel();

        assertEq(uint8(circle.state()), uint8(Circle.State.Cancelled));
    }

    // --- cancel(): forbidden ---

    function test_cancel_revertsBeforeFillDeadline() public {
        vm.expectRevert(Circle.FillDeadlineNotPassed.selector);
        circle.cancel();
    }

    function test_cancel_revertsWhenNotForming() public {
        _fillCircle();
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Forming, Circle.State.Active));
        circle.cancel();
    }

    // --- contribute(): guard only, body not implemented yet ---

    function test_contribute_revertsWhenNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Active, Circle.State.Forming));
        circle.contribute();
    }

    function test_contribute_revertsWhenNotMember() public {
        _fillCircle();
        vm.expectRevert(Circle.NotMember.selector);
        circle.contribute();
    }

    function test_contribute_reachesStubWhenActiveMember() public {
        _fillCircle();
        vm.expectRevert(Circle.NotImplemented.selector);
        vm.prank(alice);
        circle.contribute();
    }

    // --- closeRound(): guard only ---

    function test_closeRound_revertsWhenNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Active, Circle.State.Forming));
        circle.closeRound();
    }

    function test_closeRound_reachesStubWhenActive() public {
        _fillCircle();
        vm.expectRevert(Circle.NotImplemented.selector);
        circle.closeRound();
    }

    // --- claim(): guard only ---

    function test_claim_revertsWhenNotStarted() public {
        vm.expectRevert(Circle.CircleNotStarted.selector);
        circle.claim();
    }

    function test_claim_reachesStubWhenActive() public {
        _fillCircle();
        vm.expectRevert(Circle.NotImplemented.selector);
        circle.claim();
    }

    // --- repay(): guard only ---

    function test_repay_revertsWhenNotStarted() public {
        vm.expectRevert(Circle.CircleNotStarted.selector);
        circle.repay();
    }

    function test_repay_reachesStubWhenActive() public {
        _fillCircle();
        vm.expectRevert(Circle.NotImplemented.selector);
        circle.repay();
    }

    // --- withdraw(): guard only ---

    function test_withdraw_revertsWhenNotCancelled() public {
        vm.expectRevert(
            abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Cancelled, Circle.State.Forming)
        );
        circle.withdraw();
    }

    function test_withdraw_revertsWhenNotMember() public {
        _cancelCircle();
        vm.expectRevert(Circle.NotMember.selector);
        circle.withdraw();
    }

    function test_withdraw_reachesStubWhenCancelledMember() public {
        vm.prank(alice);
        circle.join();
        _cancelCircle();
        vm.expectRevert(Circle.NotImplemented.selector);
        vm.prank(alice);
        circle.withdraw();
    }
}
