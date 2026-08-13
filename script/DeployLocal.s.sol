// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CircleFactory} from "../src/CircleFactory.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys CircleFactory and a mock stablecoin to a local Anvil
/// chain, for frontend development while the real testnet isn't up yet.
/// Not for testnet/mainnet — that's stage 5, with its own script.
contract DeployLocal is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 token = new MockERC20();
        CircleFactory factory = new CircleFactory();
        token.mint(msg.sender, 1_000_000e18);

        vm.stopBroadcast();

        console.log("MockERC20:", address(token));
        console.log("CircleFactory:", address(factory));

        string memory json = "deployment";
        vm.serializeAddress(json, "token", address(token));
        string memory finalJson = vm.serializeAddress(json, "factory", address(factory));
        vm.writeJson(finalJson, "./frontend/src/generated/local-deployment.json");
    }
}
