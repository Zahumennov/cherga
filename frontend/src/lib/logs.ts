import type { Abi, ContractEventName, GetContractEventsParameters, GetContractEventsReturnType, PublicClient } from "viem";

// Headroom under Whitechain's public RPC eth_getLogs cap ("query exceeds
// max block range 10000"). Anvil has no such limit, but chunking is a
// no-op there anyway — one range covers its whole (tiny) chain history.
const MAX_RANGE = 9_000n;

/// getContractEvents scoped to a single fromBlock→latest window fails on
/// Whitechain once the range crosses ~10,000 blocks — this chain produces
/// blocks fast enough that "since the factory was deployed" alone gets
/// there within hours. Splits the range into windows and runs them in
/// parallel instead of one unbounded call.
export async function getContractEventsChunked<
  const abi extends Abi | readonly unknown[],
  eventName extends ContractEventName<abi> | undefined = undefined,
>(
  publicClient: PublicClient,
  params: GetContractEventsParameters<abi, eventName> & { fromBlock: bigint },
): Promise<GetContractEventsReturnType<abi, eventName>> {
  const latest = await publicClient.getBlockNumber();
  const ranges: { from: bigint; to: bigint }[] = [];
  for (let from = params.fromBlock; from <= latest; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n < latest ? from + MAX_RANGE - 1n : latest;
    ranges.push({ from, to });
  }
  if (ranges.length === 0) return [] as unknown as GetContractEventsReturnType<abi, eventName>;

  const chunks = await Promise.all(
    ranges.map(({ from, to }) => publicClient.getContractEvents({ ...params, fromBlock: from, toBlock: to })),
  );
  return chunks.flat() as GetContractEventsReturnType<abi, eventName>;
}
