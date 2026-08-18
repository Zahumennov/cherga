/// viem wraps every error in a BaseError whose `.message` is a whole essay
/// — short reason, then raw request args, contract call details, a docs
/// link, and the viem version. Fine for a terminal, unreadable dumped onto
/// a screen. `.shortMessage` is the same error's first line only ("User
/// rejected the request.", "The contract function reverted...") — that's
/// the one worth showing a user.
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : fallback;
}
