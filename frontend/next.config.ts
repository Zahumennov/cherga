import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully client-rendered app (no server actions, no route handlers, no
  // server-side data fetching — everything reads from the chain in the
  // browser via wagmi/viem), so a static export is all it needs: plain
  // HTML/CSS/JS deployable anywhere, no Node/edge runtime to host.
  output: "export",
};

export default nextConfig;
