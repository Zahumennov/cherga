import { keccak256, type Hex } from "viem";

/// A circle's invite secret: 32 random bytes, generated client-side and
/// never sent anywhere but the URL fragment (never a server — there isn't
/// one). Only its hash goes on-chain.
export function generateSecret(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

/// Matches Circle.sol: keccak256(abi.encodePacked(secret)) — packed
/// encoding of a single bytes32 is just its raw bytes, so this is the
/// same as keccak256(secret) directly.
export function inviteHashFor(secret: Hex): Hex {
  return keccak256(secret);
}
