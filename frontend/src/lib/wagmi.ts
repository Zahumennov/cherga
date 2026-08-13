import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

// Not a real network — Foundry's local dev chain (`anvil`). Real chains
// (Whitechain + one L2 testnet) get their own config in stage 5.
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

export const wagmiConfig = createConfig({
  chains: [anvilLocal],
  connectors: [injected()],
  transports: {
    [anvilLocal.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
