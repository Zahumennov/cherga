import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully client-rendered app (no server actions, no route handlers, no
  // server-side data fetching — everything reads from the chain in the
  // browser via wagmi/viem), so a static export is all it needs: plain
  // HTML/CSS/JS deployable anywhere, no Node/edge runtime to host.
  output: "export",
  // `next dev` refuses cross-origin requests to its JS chunks by default —
  // without this, opening the dev server from a phone on the same Wi-Fi
  // (via the LAN IP) loads the static HTML shell but every client
  // component (ConnectKit's button included) silently fails to hydrate.
  // Dev-only; irrelevant to the static export that actually ships.
  // This is the maintainer's own machine's LAN IP — replace with your
  // own (`ipconfig getifaddr en0` on macOS) to test from a phone locally.
  allowedDevOrigins: ["192.168.1.131"],
};

export default nextConfig;
