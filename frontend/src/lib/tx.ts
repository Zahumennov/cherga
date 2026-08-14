import type { Hex, PublicClient } from "viem";

/// viem's waitForTransactionReceipt resolves on a reverted receipt just
/// like a successful one — it does not throw. Every screen that sends a
/// transaction has to check status itself, or a revert silently renders
/// as success.
export async function waitForSuccess(publicClient: PublicClient, hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(
      "The transaction was rejected on-chain — nothing happened. This usually means the circle's state changed since the page loaded (a deadline passed, someone else acted first). Refresh and try again.",
    );
  }
  return receipt;
}
