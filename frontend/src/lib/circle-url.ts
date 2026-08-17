import type { Address } from "viem";

// Circle address lives in a query param, not the path — a static export
// can't pre-render a page per arbitrary on-chain address, so every circle
// screen is one file reading ?address= client-side instead of /c/[address].
export function circleUrl(address: Address, page?: "invite" | "join" | "contribute" | "claim" | "repay") {
  const base = page ? `/c/${page}` : "/c";
  return `${base}?address=${address}`;
}
