// Minimal ERC-20 surface we actually call — allowance/approve for the
// two-step approve-then-spend flow contribute() and repay() both need.
export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Not a standard ERC-20 function — specific to MockERC20 (test/mocks/MockERC20.sol),
// which anyone can call for anyone, by design: there's no real stablecoin to
// bridge on a brand-new testnet, so this is the faucet.
export const mockErc20MintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
