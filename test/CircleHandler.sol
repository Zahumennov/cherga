// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Bounds the invariant fuzzer to a fixed pool of actors making
/// plausible calls against one Circle, so it spends its budget exploring
/// real state transitions instead of reverting on garbage input. Reverts
/// from the circle itself are swallowed (try/catch) — an invalid call is a
/// normal outcome here, not a harness failure.
contract CircleHandler is Test {
    Circle public circle;
    MockERC20 public token;
    bytes32 public immutable secret;

    /// @dev Deliberately more actors than memberCount, so some never get a
    /// seat — needed to exercise invariant I6 (non-members never touch funds).
    address[] public actors;

    /// @dev Captured once, the first time closeRound() succeeds and the
    /// circle reaches Active — used to check I3 (order never changes).
    address[] public orderSnapshot;

    // --- ghost accounting: invariants that aren't readable off plain contract state ---

    uint256 public ghost_sumContributed;
    uint256 public ghost_sumClaimed;
    mapping(address actor => uint256) public ghost_totalContributedBy;

    constructor(Circle circle_, MockERC20 token_, bytes32 secret_, address[] memory actors_) {
        circle = circle_;
        token = token_;
        secret = secret_;
        actors = actors_;
    }

    function actorsCount() external view returns (uint256) {
        return actors.length;
    }

    function orderSnapshotLength() external view returns (uint256) {
        return orderSnapshot.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    // --- fuzzed actions ---

    function join(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        vm.prank(actor);
        try circle.join(secret) {} catch {}
    }

    function contribute(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        uint256 amount = circle.contribution();

        token.mint(actor, amount);
        vm.prank(actor);
        token.approve(address(circle), amount);

        vm.prank(actor);
        try circle.contribute() {
            ghost_sumContributed += amount;
            ghost_totalContributedBy[actor] += amount;
        } catch {}
    }

    function closeRound() external {
        if (circle.state() != Circle.State.Active) return;

        uint64 roundEnd = circle.roundEnd();
        if (block.timestamp < roundEnd) vm.warp(roundEnd);

        try circle.closeRound() {
            if (orderSnapshot.length == 0) _snapshotOrder();
        } catch {}
    }

    function claim(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        uint256 amount = circle.claimable(actor);

        vm.prank(actor);
        try circle.claim() {
            ghost_sumClaimed += amount;
        } catch {}
    }

    function repay(uint256 debtorSeed, uint256 creditorSeed, uint256 amountSeed) external {
        address debtor = _actor(debtorSeed);
        address creditor = _actor(creditorSeed);

        uint256 owed = circle.debts(debtor, creditor);
        if (owed == 0) return;
        uint256 amount = 1 + (amountSeed % owed);

        token.mint(debtor, amount);
        vm.prank(debtor);
        token.approve(address(circle), amount);

        vm.prank(debtor);
        try circle.repay(creditor, amount) {} catch {}
    }

    function cancel() external {
        if (circle.state() != Circle.State.Forming) return;

        uint64 deadline = circle.fillDeadline();
        if (block.timestamp < deadline) vm.warp(deadline);

        try circle.cancel() {} catch {}
    }

    /// @dev Small forward time jumps, so timing-dependent paths (deadlines,
    /// round windows) get explored without the fuzzer needing to "discover" warp.
    function warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + (secondsSeed % 3 days));
    }

    function _snapshotOrder() internal {
        uint8 n = circle.memberCount();
        for (uint8 i = 0; i < n; i++) {
            orderSnapshot.push(circle.order(i));
        }
    }
}
