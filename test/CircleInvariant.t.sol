// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {CircleHandler} from "./CircleHandler.sol";

/// @notice Invariants I1-I7 from docs/spec.md, checked against a bounded
/// handler driving random-but-plausible calls into one Circle. If this
/// harness finds nothing after a real run, the harness is wrong — the code
/// is not assumed to be perfect (CLAUDE.md, stage 4 DoD).
contract CircleInvariantTest is Test {
    uint256 constant CONTRIBUTION = 100e18;
    uint8 constant MEMBER_COUNT = 5;
    uint32 constant ROUND_DURATION = 7 days;
    uint256 constant ACTOR_COUNT = 8; // > MEMBER_COUNT on purpose, see CircleHandler

    Circle circle;
    MockERC20 token;
    CircleHandler handler;

    function setUp() public {
        token = new MockERC20();

        bytes32 secret = keccak256("invariant-secret");
        bytes32 inviteHash = keccak256(abi.encodePacked(secret));
        uint64 fillDeadline = uint64(block.timestamp + 7 days);
        circle = new Circle(address(token), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, fillDeadline, inviteHash);

        address[] memory actors = new address[](ACTOR_COUNT);
        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            actors[i] = makeAddr(string(abi.encodePacked("actor", vm.toString(i))));
        }

        handler = new CircleHandler(circle, token, secret, actors);

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = CircleHandler.join.selector;
        selectors[1] = CircleHandler.contribute.selector;
        selectors[2] = CircleHandler.closeRound.selector;
        selectors[3] = CircleHandler.claim.selector;
        selectors[4] = CircleHandler.repay.selector;
        selectors[5] = CircleHandler.cancel.selector;
        selectors[6] = CircleHandler.warp.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        targetContract(address(handler));
    }

    function _sumClaimable() internal view returns (uint256 sum) {
        uint256 n = handler.actorsCount();
        for (uint256 i = 0; i < n; i++) {
            sum += circle.claimable(handler.actors(i));
        }
    }

    /// I1: balanceOf(contract) == unclaimed payouts + current round's contributions
    function invariant_I1_balanceMatchesBookedFunds() public view {
        uint256 expected = _sumClaimable();
        if (circle.state() == Circle.State.Active) {
            (uint256 collected,) = circle.rounds(circle.currentRound());
            expected += collected;
        }
        assertEq(token.balanceOf(address(circle)), expected);
    }

    /// I2: every member is the recipient of exactly one round
    function invariant_I2_eachMemberIsRecipientExactlyOnce() public view {
        // order.length == memberCount is only guaranteed once the circle has
        // actually filled — Cancelled can happen with a partially-filled
        // order, and indexing past its length reverts (found by the fuzzer,
        // see FINDINGS.md).
        if (circle.state() != Circle.State.Active && circle.state() != Circle.State.Completed) return;

        uint256 n = handler.actorsCount();
        for (uint256 i = 0; i < n; i++) {
            address actor = handler.actors(i);
            if (!circle.isMember(actor)) continue;

            uint256 occurrences;
            for (uint8 r = 0; r < MEMBER_COUNT; r++) {
                if (circle.order(r) == actor) occurrences++;
            }
            assertEq(occurrences, 1);
        }
    }

    /// I3: payout order never changes once the circle starts
    function invariant_I3_orderNeverChangesAfterStart() public view {
        uint256 snapshotLen = handler.orderSnapshotLength();
        if (snapshotLen == 0) return;

        for (uint256 i = 0; i < snapshotLen; i++) {
            assertEq(circle.order(i), handler.orderSnapshot(i));
        }
    }

    /// I4: total claimed by everyone never exceeds total contributed by everyone
    function invariant_I4_neverPaysOutMoreThanContributed() public view {
        assertLe(handler.ghost_sumClaimed(), handler.ghost_sumContributed());
    }

    /// I5: no member ever contributes more than C x memberCount across the circle's life
    function invariant_I5_perMemberContributionCapped() public view {
        uint256 cap = CONTRIBUTION * MEMBER_COUNT;
        uint256 n = handler.actorsCount();
        for (uint256 i = 0; i < n; i++) {
            assertLe(handler.ghost_totalContributedBy(handler.actors(i)), cap);
        }
    }

    /// I6: money never reaches an address outside order — non-members hold
    /// no claimable balance and are owed no debt by anyone.
    function invariant_I6_moneyOnlyMovesWithinOrder() public view {
        uint256 n = handler.actorsCount();
        for (uint256 i = 0; i < n; i++) {
            address actor = handler.actors(i);
            if (circle.isMember(actor)) continue;

            assertEq(circle.claimable(actor), 0);
            for (uint256 j = 0; j < n; j++) {
                assertEq(circle.debts(handler.actors(j), actor), 0);
            }
        }
    }

    /// I7: once Completed and every claim() has been made, balance is exactly zero
    function invariant_I7_completedAndFullyClaimedMeansZeroBalance() public view {
        if (circle.state() != Circle.State.Completed) return;
        if (_sumClaimable() != 0) return;
        assertEq(token.balanceOf(address(circle)), 0);
    }
}
