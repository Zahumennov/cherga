"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId } from "wagmi";

/// The chain's own notion of "now" (latest block timestamp), not the
/// browser's clock — a client's system clock can be skewed relative to
/// the network, and "is this round ready to close" has to agree with
/// what the contract itself will actually check.
export function useChainTime() {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { data } = useQuery({
    queryKey: ["chain-time", chainId],
    enabled: !!publicClient,
    refetchInterval: 4000,
    queryFn: async () => {
      const block = await publicClient!.getBlock();
      return Number(block.timestamp);
    },
  });
  return data ?? 0;
}
