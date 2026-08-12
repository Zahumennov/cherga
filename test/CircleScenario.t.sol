// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Circle} from "../src/Circle.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice End-to-end circle scenarios, as opposed to Circle.t.sol's
/// per-function unit tests. Each test drives a circle through multiple
/// real rounds to check the money actually balances out at the end.
contract CircleScenarioTest is Test {
    uint256 constant CONTRIBUTION = 100e18;
    uint32 constant ROUND_DURATION = 30 days;

    MockERC20 token;

    function setUp() public {
        token = new MockERC20();
    }

    /// @dev Deploys a circle with `n` members who all join immediately, in order.
    function _newCircle(uint8 n) internal returns (Circle circle, address[] memory members) {
        uint64 fillDeadline = uint64(block.timestamp + 7 days);
        circle = new Circle(address(token), CONTRIBUTION, n, ROUND_DURATION, fillDeadline);

        members = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            address member = makeAddr(string(abi.encodePacked("member", vm.toString(i))));
            members[i] = member;
            vm.prank(member);
            circle.join();
        }
    }

    function _pay(Circle circle, address member) internal {
        token.mint(member, CONTRIBUTION);
        vm.prank(member);
        token.approve(address(circle), CONTRIBUTION);
        vm.prank(member);
        circle.contribute();
    }

    /// @dev Pays the current round's contribution for everyone except the
    /// recipient (who can't pay) and `skip` (used to simulate a default).
    /// Pass address(0) for a round where nobody defaults.
    function _payRoundExcept(Circle circle, address[] memory members, address skip) internal {
        address recipient = circle.order(circle.currentRound() - 1);
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            if (member == recipient || member == skip) continue;
            _pay(circle, member);
        }
    }

    function _closeRound(Circle circle) internal {
        vm.warp(circle.roundEnd());
        circle.closeRound();
    }

    function _repay(Circle circle, address debtor, address creditor, uint256 amount) internal {
        token.mint(debtor, amount);
        vm.prank(debtor);
        token.approve(address(circle), amount);
        vm.prank(debtor);
        circle.repay(creditor, amount);
    }

    function _claimAll(Circle circle, address[] memory members) internal {
        for (uint256 i = 0; i < members.length; i++) {
            vm.prank(members[i]);
            circle.claim();
        }
    }

    function test_scenario_fullCircle_noDefaults() public {
        (Circle circle, address[] memory members) = _newCircle(3);

        for (uint8 round = 1; round <= 3; round++) {
            _payRoundExcept(circle, members, address(0));
            _closeRound(circle);
        }

        assertEq(uint8(circle.state()), uint8(Circle.State.Completed));

        _claimAll(circle, members);

        assertEq(token.balanceOf(address(circle)), 0);
    }

    function test_scenario_oneDefault_balanceEndsZeroDespiteOutstandingDebt() public {
        (Circle circle, address[] memory members) = _newCircle(3);
        address recipient1 = members[0];

        // round 1: members[2] defaults on paying into round 1's pool
        _payRoundExcept(circle, members, members[2]);
        _closeRound(circle);

        // rounds 2-3: everyone pays as expected
        _payRoundExcept(circle, members, address(0));
        _closeRound(circle);
        _payRoundExcept(circle, members, address(0));
        _closeRound(circle);

        assertEq(circle.debts(members[2], recipient1), CONTRIBUTION);

        _claimAll(circle, members);

        // the debt was never repaid, but it's owed wallet-to-wallet, not
        // held by the contract — the contract's own balance still zeroes out.
        assertEq(token.balanceOf(address(circle)), 0);
        assertEq(circle.debts(members[2], recipient1), CONTRIBUTION);
    }

    /// @notice DoD scenario: 10 rounds, one default on round 4, repaid on
    /// round 8, contract balance == 0 at the end.
    function test_scenario_dod_tenRounds_defaultAtFour_repayAtEight() public {
        (Circle circle, address[] memory members) = _newCircle(10);
        address defaulter = members[5];
        address round4Recipient = members[3];

        for (uint8 round = 1; round <= 10; round++) {
            if (round == 4) {
                _payRoundExcept(circle, members, defaulter);
            } else {
                _payRoundExcept(circle, members, address(0));
            }

            if (round == 8) {
                _repay(circle, defaulter, round4Recipient, CONTRIBUTION);
            }

            _closeRound(circle);
        }

        assertEq(uint8(circle.state()), uint8(Circle.State.Completed));
        assertEq(circle.debts(defaulter, round4Recipient), 0);

        _claimAll(circle, members);

        assertEq(token.balanceOf(address(circle)), 0);
    }
}
