// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CircleFactory} from "../src/CircleFactory.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys CircleFactory and a mock stablecoin to a real testnet.
/// No stablecoin exists yet on a brand-new L2 testnet, so this deploys the
/// same publicly-mintable mock used locally — real users self-serve test
/// tokens rather than needing a bridge. Addresses get recorded by hand in
/// DEPLOYMENTS.md after a run, not written to a JSON file (that's the
/// local-only DeployLocal.s.sol convenience, not a testnet concern).
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 token = new MockERC20();
        CircleFactory factory = new CircleFactory();
        // Convenience for seeding a first demo circle — mint() is public,
        // so anyone (including test friends) can also mint their own.
        token.mint(msg.sender, 1_000_000e18);

        vm.stopBroadcast();

        console.log("MockERC20:", address(token));
        console.log("CircleFactory:", address(factory));
    }
}
