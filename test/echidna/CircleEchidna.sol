// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Circle} from "../../src/Circle.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @dev Minimal hevm cheatcode interface — Echidna implements the same
/// cheatcode address Foundry uses, but doesn't understand forge-std's `Vm`.
interface IHevm {
    function warp(uint256 newTimestamp) external;
    function prank(address sender) external;
}

/// @notice Echidna property harness for I1-I7 — the same invariants as
/// CircleInvariant.t.sol, deliberately re-implemented independently rather
/// than shared, since the whole point of a second fuzzer is a different
/// exploration strategy finding different things.
contract CircleEchidna {
    IHevm constant hevm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint256 constant CONTRIBUTION = 100e18;
    uint8 constant MEMBER_COUNT = 5;
    uint32 constant ROUND_DURATION = 7 days;

    Circle circle;
    MockERC20 token;
    bytes32 constant SECRET = keccak256("echidna-secret");

    /// @dev 8 actors for a 5-seat circle — the extra 3 never get in, needed for I6.
    address[] actors;
    address[] orderSnapshot;

    uint256 ghost_sumContributed;
    uint256 ghost_sumClaimed;
    mapping(address => uint256) ghost_totalContributedBy;

    constructor() {
        token = new MockERC20();
        bytes32 inviteHash = keccak256(abi.encodePacked(SECRET));
        circle = new Circle(
            address(token), CONTRIBUTION, MEMBER_COUNT, ROUND_DURATION, uint64(block.timestamp + 7 days), inviteHash
        );

        for (uint256 i = 1; i <= 8; i++) {
            actors.push(address(uint160(i * 0x10000)));
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    // --- actions ---

    function join(uint256 seed) external {
        address actor = _actor(seed);
        hevm.prank(actor);
        try circle.join(SECRET) {} catch {}
    }

    function contribute(uint256 seed) external {
        address actor = _actor(seed);
        uint256 amount = circle.contribution();

        token.mint(actor, amount);
        hevm.prank(actor);
        token.approve(address(circle), amount);

        hevm.prank(actor);
        try circle.contribute() {
            ghost_sumContributed += amount;
            ghost_totalContributedBy[actor] += amount;
        } catch {}
    }

    function closeRound() external {
        if (circle.state() != Circle.State.Active) return;

        uint64 roundEnd = circle.roundEnd();
        if (block.timestamp < roundEnd) hevm.warp(roundEnd);

        try circle.closeRound() {
            if (orderSnapshot.length == 0) {
                uint8 n = circle.memberCount();
                for (uint8 i = 0; i < n; i++) {
                    orderSnapshot.push(circle.order(i));
                }
            }
        } catch {}
    }

    function claim(uint256 seed) external {
        address actor = _actor(seed);
        uint256 amount = circle.claimable(actor);

        hevm.prank(actor);
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
        hevm.prank(debtor);
        token.approve(address(circle), amount);

        hevm.prank(debtor);
        try circle.repay(creditor, amount) {} catch {}
    }

    function cancel() external {
        if (circle.state() != Circle.State.Forming) return;

        uint64 deadline = circle.fillDeadline();
        if (block.timestamp < deadline) hevm.warp(deadline);

        try circle.cancel() {} catch {}
    }

    function warp(uint256 secondsSeed) external {
        hevm.warp(block.timestamp + (secondsSeed % 3 days));
    }

    // --- properties (I1-I7) ---

    function echidna_I1_balanceMatchesBookedFunds() external view returns (bool) {
        uint256 expected;
        for (uint256 i = 0; i < actors.length; i++) {
            expected += circle.claimable(actors[i]);
        }
        if (circle.state() == Circle.State.Active) {
            (uint256 collected,) = circle.rounds(circle.currentRound());
            expected += collected;
        }
        return token.balanceOf(address(circle)) == expected;
    }

    function echidna_I2_eachMemberIsRecipientExactlyOnce() external view returns (bool) {
        if (circle.state() != Circle.State.Active && circle.state() != Circle.State.Completed) {
            return true;
        }

        for (uint256 i = 0; i < actors.length; i++) {
            address actor = actors[i];
            if (!circle.isMember(actor)) continue;

            uint256 occurrences;
            for (uint8 r = 0; r < MEMBER_COUNT; r++) {
                if (circle.order(r) == actor) occurrences++;
            }
            if (occurrences != 1) return false;
        }
        return true;
    }

    function echidna_I3_orderNeverChangesAfterStart() external view returns (bool) {
        for (uint256 i = 0; i < orderSnapshot.length; i++) {
            if (circle.order(i) != orderSnapshot[i]) return false;
        }
        return true;
    }

    function echidna_I4_neverPaysOutMoreThanContributed() external view returns (bool) {
        return ghost_sumClaimed <= ghost_sumContributed;
    }

    function echidna_I5_perMemberContributionCapped() external view returns (bool) {
        uint256 cap = CONTRIBUTION * MEMBER_COUNT;
        for (uint256 i = 0; i < actors.length; i++) {
            if (ghost_totalContributedBy[actors[i]] > cap) return false;
        }
        return true;
    }

    function echidna_I6_moneyOnlyMovesWithinOrder() external view returns (bool) {
        for (uint256 i = 0; i < actors.length; i++) {
            address actor = actors[i];
            if (circle.isMember(actor)) continue;

            if (circle.claimable(actor) != 0) return false;
            for (uint256 j = 0; j < actors.length; j++) {
                if (circle.debts(actors[j], actor) != 0) return false;
            }
        }
        return true;
    }

    function echidna_I7_completedAndFullyClaimedMeansZeroBalance() external view returns (bool) {
        if (circle.state() != Circle.State.Completed) return true;
        for (uint256 i = 0; i < actors.length; i++) {
            if (circle.claimable(actors[i]) != 0) return true;
        }
        return token.balanceOf(address(circle)) == 0;
    }
}
