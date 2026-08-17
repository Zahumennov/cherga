# Cherga frontend

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, connecting to
`Circle`/`CircleFactory` via wagmi/viem + ConnectKit.

## Local development

Against a local Anvil chain (fast, free, no faucet) rather than Whitechain
testnet directly — see `DEPLOYMENTS.md` for the real deployment. Three
terminals, from the **repo root** (not `frontend/`) for the first two:

**1. Start a local chain:**

```bash
anvil
```

Copy the private key for `(0)` that it prints — you'll use it below and to
import that account into a browser wallet for manual testing (it's a public,
well-known test-only key; it only ever controls funds on your own local chain).

**2. Deploy the contracts:**

```bash
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <paste the key from step 1>
```

This deploys `CircleFactory` and a mock ERC-20, mints 1,000,000 tokens to the
deployer, and writes addresses to `frontend/src/generated/local-deployment.json`.
Re-run this after restarting `anvil` (a fresh chain has no deployed contracts).

**3. Sync the contract ABIs** (only needed after changing `.sol` files):

```bash
cd frontend
pnpm sync-abi
```

**4. Run the app:**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Connect with "Browser
Wallet" (MetaMask or similar) — import one of Anvil's printed test accounts
to have funds and, after minting, mock tokens to test with.

`frontend/src/generated/` (ABIs + deployment addresses) is gitignored —
it's regenerated locally, not committed.

## Deploying

A fully static export (`output: "export"` in `next.config.ts`) — no
server, no Node/edge runtime to host, deployable as plain HTML/CSS/JS.
Circle addresses live in query params (`/c?address=0x...`), not the
path, since a static export can't pre-render a page per arbitrary
on-chain address — see `src/lib/circle-url.ts`.

Deployed via Cloudflare Pages, connected to this GitHub repo:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `pnpm build` |
| Build output directory | `out` |

Node and pnpm versions come from `.node-version` and `package.json`'s
`packageManager` field — Cloudflare's build image reads both.
