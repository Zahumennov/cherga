// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Circle} from "../src/Circle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {BadERC20} from "./mocks/BadERC20.sol";

contract CircleTest is Test {
    Circle circle;
    MockERC20 mockToken;
    address token;

    uint256 constant CONTRIBUTION = 100e18;
    uint8 constant MEMBER_COUNT = 3;
    uint32 constant ROUND_DURATION = 30 days;
    bytes32 constant SECRET = keccak256("cherga-test-secret");
    bytes32 constant INVITE_HASH = keccak256(abi.encodePacked(SECRET));
    uint64 fillDeadline;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    function setUp() public {
        mockToken = new MockERC20();
        token = address(mockToken);
        fillDeadline = uint64(block.timestamp + 7 days);
        circle = new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    function _fillCircle() internal {
        vm.prank(alice);
        circle.join(SECRET);
        vm.prank(bob);
        circle.join(SECRET);
        vm.prank(carol);
        circle.join(SECRET);
    }

    /// @dev Mints `contribution` to `member` and approves the circle to pull it.
    function _fundMember(address member) internal {
        mockToken.mint(member, CONTRIBUTION);
        vm.prank(member);
        mockToken.approve(address(circle), CONTRIBUTION);
    }

    /// @dev Funds and pays the current round's contribution for `member`.
    function _payRound(address member) internal {
        _fundMember(member);
        vm.prank(member);
        circle.contribute();
    }

    // --- constructor: allowed ---

    function test_constructor_setsParametersAndForming() public view {
        assertEq(circle.token(), token);
        assertEq(circle.contribution(), CONTRIBUTION);
        assertEq(circle.memberCount(), MEMBER_COUNT);
        assertEq(circle.roundDuration(), ROUND_DURATION);
        assertEq(circle.fillDeadline(), fillDeadline);
        assertEq(circle.inviteHash(), INVITE_HASH);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function test_constructor_emitsCircleCreated() public {
        vm.expectEmit(true, true, true, true);
        emit Circle.CircleCreated(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    // --- constructor: forbidden ---

    function test_constructor_revertsOnZeroAddressToken() public {
        vm.expectRevert(Circle.ZeroAddress.selector);
        new Circle(address(0), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    function test_constructor_revertsOnZeroContribution() public {
        vm.expectRevert(Circle.ZeroContribution.selector);
        new Circle(token, 0, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    function test_constructor_revertsOnMemberCountTooLow() public {
        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(token, CONTRIBUTION, 1, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    function test_constructor_revertsOnMemberCountTooHigh() public {
        vm.expectRevert(Circle.InvalidMemberCount.selector);
        new Circle(token, CONTRIBUTION, 21, ROUND_DURATION, fillDeadline, INVITE_HASH);
    }

    function test_constructor_revertsOnZeroRoundDuration() public {
        vm.expectRevert(Circle.InvalidRoundDuration.selector);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, 0, fillDeadline, INVITE_HASH);
    }

    function test_constructor_revertsOnPastFillDeadline() public {
        vm.expectRevert(Circle.FillDeadlineInPast.selector);
        new Circle(token, CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, uint64(block.timestamp), INVITE_HASH);
    }

    // --- join(): allowed ---

    function test_join_addsMemberAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit Circle.MemberJoined(alice, 0);
        vm.prank(alice);
        circle.join(SECRET);

        assertTrue(circle.isMember(alice));
        assertEq(circle.order(0), alice);
        assertEq(uint8(circle.state()), uint8(Circle.State.Forming));
    }

    function test_join_activatesOnLastMember() public {
        vm.prank(alice);
        circle.join(SECRET);
        vm.prank(bob);
        circle.join(SECRET);

        vm.expectEmit(true, true, true, true);
        emit Circle.CircleActivated(uint64(block.timestamp) + ROUND_DURATION);
        vm.prank(carol);
        circle.join(SECRET);

        assertEq(uint8(circle.state()), uint8(Circle.State.Active));
        assertEq(circle.currentRound(), 1);
        assertEq(circle.roundEnd(), uint64(block.timestamp) + ROUND_DURATION);
    }

    // --- join(): forbidden ---

    function test_join_revertsWhenNotForming() public {
        _fillCircle();
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Forming, Circle.State.Active));
        vm.prank(dave);
        circle.join(SECRET);
    }

    function test_join_revertsWhenAlreadyMember() public {
        vm.startPrank(alice);
        circle.join(SECRET);
        vm.expectRevert(Circle.AlreadyMember.selector);
        circle.join(SECRET);
        vm.stopPrank();
    }

    function test_join_revertsAfterFillDeadline() public {
        vm.warp(fillDeadline);
        vm.expectRevert(Circle.FillDeadlinePassed.selector);
        vm.prank(alice);
        circle.join(SECRET);
    }

    function test_join_revertsWithWrongSecret() public {
        vm.expectRevert(Circle.InvalidInvite.selector);
        vm.prank(alice);
        circle.join(keccak256("wrong-secret"));
    }

    // --- cancel(): allowed ---

    function test_cancel_movesToCancelled() public {
        vm.prank(alice);
        circle.join(SECRET);

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

    // --- contribute(): allowed ---

    function test_contribute_transfersTokenAndRecordsCollected() public {
        _fillCircle();
        _fundMember(bob);

        vm.expectEmit(true, true, true, true);
        emit Circle.Contributed(bob, 1, CONTRIBUTION);
        vm.prank(bob);
        circle.contribute();

        assertEq(mockToken.balanceOf(bob), 0);
        assertEq(mockToken.balanceOf(address(circle)), CONTRIBUTION);
        assertTrue(circle.hasContributed(1, bob));

        (uint256 collected,) = circle.rounds(1);
        assertEq(collected, CONTRIBUTION);
    }

    // --- contribute(): forbidden ---

    function test_contribute_revertsWhenNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Active, Circle.State.Forming));
        circle.contribute();
    }

    function test_contribute_revertsWhenNotMember() public {
        _fillCircle();
        vm.expectRevert(Circle.NotMember.selector);
        circle.contribute();
    }

    function test_contribute_revertsWhenIsRecipient() public {
        _fillCircle();
        vm.expectRevert(Circle.IsRecipient.selector);
        vm.prank(alice);
        circle.contribute();
    }

    function test_contribute_revertsWhenAlreadyContributed() public {
        _fillCircle();
        _fundMember(bob);
        vm.prank(bob);
        circle.contribute();

        vm.expectRevert(Circle.AlreadyContributed.selector);
        vm.prank(bob);
        circle.contribute();
    }

    function test_contribute_revertsWithBadToken() public {
        BadERC20 badToken = new BadERC20();
        Circle badCircle =
            new Circle(address(badToken), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, INVITE_HASH);

        vm.prank(alice);
        badCircle.join(SECRET);
        vm.prank(bob);
        badCircle.join(SECRET);
        vm.prank(carol);
        badCircle.join(SECRET);

        badToken.mint(bob, CONTRIBUTION);
        vm.prank(bob);
        badToken.approve(address(badCircle), CONTRIBUTION);

        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(badToken)));
        vm.prank(bob);
        badCircle.contribute();
    }

    // --- closeRound(): allowed ---

    function test_closeRound_closesFullyPaidRoundAfterDeadline() public {
        _fillCircle();
        _payRound(bob);
        _payRound(carol);

        vm.warp(circle.roundEnd());

        vm.expectEmit(true, true, true, true);
        emit Circle.RoundClosed(1, alice, CONTRIBUTION * 2, 0);
        circle.closeRound();

        assertEq(circle.claimable(alice), CONTRIBUTION * 2);
        assertEq(circle.debts(carol, alice), 0);
        assertEq(circle.currentRound(), 2);

        (, bool closed) = circle.rounds(1);
        assertTrue(closed);
    }

    function test_closeRound_closesEarlyWhenFullyPaid() public {
        _fillCircle();
        _payRound(bob);
        _payRound(carol);

        // still well before roundEnd — early close is allowed once everyone paid
        circle.closeRound();

        assertEq(circle.currentRound(), 2);
    }

    function test_closeRound_recordsDebtForNonPayer() public {
        _fillCircle();
        _payRound(bob);
        // carol never pays

        vm.warp(circle.roundEnd());

        vm.expectEmit(true, true, true, true);
        emit Circle.Defaulted(carol, alice, 1, CONTRIBUTION);
        vm.expectEmit(true, true, true, true);
        emit Circle.RoundClosed(1, alice, CONTRIBUTION, CONTRIBUTION);
        circle.closeRound();

        assertEq(circle.claimable(alice), CONTRIBUTION);
        assertEq(circle.debts(carol, alice), CONTRIBUTION);
        assertEq(circle.debts(bob, alice), 0);
    }

    function test_closeRound_setsCompletedAfterLastRound() public {
        _fillCircle();

        // round 1 — alice is recipient
        _payRound(bob);
        _payRound(carol);
        vm.warp(circle.roundEnd());
        circle.closeRound();

        // round 2 — bob is recipient
        _payRound(alice);
        _payRound(carol);
        vm.warp(circle.roundEnd());
        circle.closeRound();

        // round 3 — carol is recipient
        _payRound(alice);
        _payRound(bob);
        vm.warp(circle.roundEnd());
        circle.closeRound();

        assertEq(uint8(circle.state()), uint8(Circle.State.Completed));
        assertEq(circle.currentRound(), 3);
    }

    // --- closeRound(): forbidden ---

    function test_closeRound_revertsWhenNotActive() public {
        vm.expectRevert(abi.encodeWithSelector(Circle.WrongState.selector, Circle.State.Active, Circle.State.Forming));
        circle.closeRound();
    }

    function test_closeRound_revertsWhenNotReady() public {
        _fillCircle();
        vm.expectRevert(Circle.RoundNotReady.selector);
        circle.closeRound();
    }

    // --- claim(): allowed ---

    function test_claim_transfersClaimableAndZeroesIt() public {
        _fillCircle();
        _payRound(bob);
        _payRound(carol);
        vm.warp(circle.roundEnd());
        circle.closeRound();

        vm.expectEmit(true, true, true, true);
        emit Circle.Claimed(alice, CONTRIBUTION * 2);
        vm.prank(alice);
        circle.claim();

        assertEq(mockToken.balanceOf(alice), CONTRIBUTION * 2);
        assertEq(circle.claimable(alice), 0);
    }

    // --- claim(): forbidden ---

    function test_claim_revertsWhenNotStarted() public {
        vm.expectRevert(Circle.CircleNotStarted.selector);
        circle.claim();
    }

    function test_claim_revertsWhenNothingToClaim() public {
        _fillCircle();
        vm.expectRevert(Circle.NothingToClaim.selector);
        vm.prank(bob);
        circle.claim();
    }

    // --- repay(): allowed ---

    function test_repay_transfersToCreditorAndReducesDebt() public {
        _fillCircle();
        _payRound(bob);
        // carol defaults
        vm.warp(circle.roundEnd());
        circle.closeRound();

        _fundMember(carol);

        vm.expectEmit(true, true, true, true);
        emit Circle.Repaid(carol, alice, CONTRIBUTION);
        vm.prank(carol);
        circle.repay(alice, CONTRIBUTION);

        assertEq(mockToken.balanceOf(alice), CONTRIBUTION);
        assertEq(circle.debts(carol, alice), 0);
    }

    function test_repay_allowsPartialRepayment() public {
        _fillCircle();
        _payRound(bob);
        vm.warp(circle.roundEnd());
        circle.closeRound();

        uint256 half = CONTRIBUTION / 2;
        mockToken.mint(carol, half);
        vm.prank(carol);
        mockToken.approve(address(circle), half);

        vm.prank(carol);
        circle.repay(alice, half);

        assertEq(circle.debts(carol, alice), CONTRIBUTION - half);
    }

    // --- repay(): forbidden ---

    function test_repay_revertsWhenNotStarted() public {
        vm.expectRevert(Circle.CircleNotStarted.selector);
        circle.repay(alice, CONTRIBUTION);
    }

    function test_repay_revertsWhenZeroAmount() public {
        _fillCircle();
        vm.expectRevert(Circle.ZeroAmount.selector);
        circle.repay(alice, 0);
    }

    function test_repay_revertsWhenExceedsDebt() public {
        _fillCircle();
        vm.expectRevert(Circle.RepayExceedsDebt.selector);
        vm.prank(bob);
        circle.repay(alice, CONTRIBUTION);
    }
}
