import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Not a real network — Foundry's local dev chain (`anvil`), for
// development while iterating on contracts/UI without spending real
// testnet gas.
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

// The only real network Cherga deploys to — see DEPLOYMENTS.md.
export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.whitechain.io"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer.testnet.whitechain.io" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [whitechainSepolia, anvilLocal],
  connectors: [injected()],
  transports: {
    [anvilLocal.id]: http(),
    [whitechainSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
