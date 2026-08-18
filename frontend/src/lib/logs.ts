import type { Abi, Address, ContractEventName, GetContractEventsParameters, GetContractEventsReturnType, PublicClient } from "viem";

// Headroom under Whitechain's public RPC eth_getLogs cap ("query exceeds
// max block range 10000"). Anvil has no such limit, but chunking is a
// no-op there anyway — one range covers its whole (tiny) chain history.
const MAX_RANGE = 9_000n;

// Capping how many chunk requests are in flight at once keeps a scan's
// burst under whatever the public RPC's rate limit actually is, at the
// cost of a cold scan taking a bit longer.
const MAX_CONCURRENT_CHUNKS = 4;

// How many blocks back from the tip we're willing to re-fetch on every
// call, in case of a reorg. Blocks older than (latest - this) are treated
// as final and never re-requested — this is what turns a recurring scan
// from O(chain age) into O(new blocks since last call).
const REORG_SAFETY_BLOCKS = 20n;

type AnyLog = Awaited<ReturnType<PublicClient["getContractEvents"]>>[number];

interface CacheEntry {
  confirmedTo: bigint;
  logs: AnyLog[];
}

// Module-level, so it survives across every hook/component that scans the
// same (chain, address, event, args, fromBlock) — the whole point is that
// the second caller for the same key, whether it's a poll of the same
// hook or a completely different hook on another page, pays for only
// what changed since the first one, not the whole history again. Reset on
// page reload, which is fine: that's already the cost every load pays
// today.
const scanCache = new Map<string, CacheEntry>();

function serializeArgs(args: unknown): string {
  return JSON.stringify(args ?? null, (_key, value) => (typeof value === "bigint" ? `${value}n` : value));
}

function scanCacheKey(
  chainId: number,
  params: { address?: Address | readonly Address[]; eventName?: unknown; args?: unknown; fromBlock: bigint },
): string {
  return [chainId, params.address ?? "*", String(params.eventName), serializeArgs(params.args), params.fromBlock.toString()].join("|");
}

/// getContractEvents scoped to a single fromBlock→latest window fails on
/// Whitechain once the range crosses ~10,000 blocks — this chain produces
/// blocks fast enough that "since the factory was deployed" alone gets
/// there within hours, and that range only grows every day the chain
/// stays up. Splits the range into windows and runs them with bounded
/// concurrency, and — the part that actually keeps this cheap long-term —
/// remembers the last block it confirmed for this exact scan and only
/// asks the RPC for what's new since then, merging onto the cached
/// result. A block is only trusted as "confirmed" once REORG_SAFETY_BLOCKS
/// have passed, so the recent tail is always re-verified rather than
/// blindly trusted forever.
export async function getContractEventsChunked<
  const abi extends Abi | readonly unknown[],
  eventName extends ContractEventName<abi> | undefined = undefined,
>(
  publicClient: PublicClient,
  params: GetContractEventsParameters<abi, eventName> & { fromBlock: bigint },
): Promise<GetContractEventsReturnType<abi, eventName>> {
  const chainId = publicClient.chain!.id;
  const key = scanCacheKey(chainId, params);
  const cached = scanCache.get(key);

  const latest = await publicClient.getBlockNumber();
  const scanFrom = cached ? cached.confirmedTo + 1n : params.fromBlock;

  if (scanFrom > latest) {
    return (cached?.logs ?? []) as unknown as GetContractEventsReturnType<abi, eventName>;
  }

  const ranges: { from: bigint; to: bigint }[] = [];
  for (let from = scanFrom; from <= latest; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n < latest ? from + MAX_RANGE - 1n : latest;
    ranges.push({ from, to });
  }

  const newChunks: AnyLog[][] = [];
  for (let i = 0; i < ranges.length; i += MAX_CONCURRENT_CHUNKS) {
    const batch = ranges.slice(i, i + MAX_CONCURRENT_CHUNKS);
    const batchResults = await Promise.all(
      batch.map(({ from, to }) => publicClient.getContractEvents({ ...params, fromBlock: from, toBlock: to })),
    );
    newChunks.push(...batchResults);
  }
  const newLogs = newChunks.flat();
  const logs = cached ? [...cached.logs, ...newLogs] : newLogs;

  const tentativeConfirmedTo = latest > REORG_SAFETY_BLOCKS ? latest - REORG_SAFETY_BLOCKS : 0n;
  const confirmedTo = cached && cached.confirmedTo > tentativeConfirmedTo ? cached.confirmedTo : tentativeConfirmedTo;
  scanCache.set(key, { confirmedTo, logs });

  return logs as unknown as GetContractEventsReturnType<abi, eventName>;
}
