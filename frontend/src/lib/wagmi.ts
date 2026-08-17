import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "connectkit";

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

// getDefaultConfig (not a bare createConfig) wires up WalletConnect,
// Coinbase Wallet, and injected together — ConnectKit's modal expects
// its own connector set, not just wagmi's injected() alone. A phone
// without an in-app wallet browser has nothing to inject, so without
// WalletConnect's QR flow there was literally no way to connect there.
export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [whitechainSepolia, anvilLocal],
    transports: {
      [anvilLocal.id]: http(),
      [whitechainSepolia.id]: http(),
    },
    walletConnectProjectId: "1f3e0703e7c389886051f1f598ed6de4",
    appName: "Cherga",
    appDescription: "A rotating savings circle — kept honestly.",
    appUrl: "https://cherga.zahumennov.dev",
    appIcon: "https://cherga.zahumennov.dev/icon.svg",
    ssr: true,
  }),
);

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
