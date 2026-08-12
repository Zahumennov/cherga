// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Non-compliant ERC-20: transfer/transferFrom silently return false
/// instead of reverting on failure, and never move balances. Used to prove
/// Circle uses SafeERC20 (which reverts on a false return) instead of a raw
/// call that would ignore it.
contract BadERC20 is ERC20 {
    constructor() ERC20("Bad USD", "bUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return false;
    }
}
