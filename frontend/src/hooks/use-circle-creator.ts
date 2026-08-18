"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { getCircleFactoryAddress, getFromBlock, CircleFactoryAbi } from "@/lib/contracts";
import { getContractEventsChunked } from "@/lib/logs";

export interface CircleCreationInfo {
  creator: Address;
  blockNumber: bigint;
}

/// The one place that scans the factory's CircleDeployed event for a given
/// circle. `blockNumber` matters beyond "who invited you" (use-circle-creator's
/// original purpose) — it's the circle's own birth block, a much tighter
/// fromBlock than the factory's deployment block for every other scan
/// that's specific to this one circle (members, debts). This scan is
/// itself still factory-wide (can't know a circle's birth block without
/// finding it first), but staleTime: Infinity plus lib/logs.ts's own
/// caching means it only really costs anything once per circle, ever,
/// shared across every hook and page that asks for it.
export function useCircleCreationInfo(circleAddress: Address) {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  return useQuery({
    queryKey: ["circle-creator", chainId, circleAddress],
    enabled: !!publicClient,
    staleTime: Infinity,
    queryFn: async (): Promise<CircleCreationInfo | null> => {
      const logs = await getContractEventsChunked(publicClient!, {
        address: getCircleFactoryAddress(chainId),
        abi: CircleFactoryAbi,
        eventName: "CircleDeployed",
        args: { circle: circleAddress },
        fromBlock: getFromBlock(chainId),
      });
      const log = logs[0];
      if (!log) return null;
      return { creator: log.args.creator as Address, blockNumber: log.blockNumber };
    },
  });
}

/// No usernames anywhere in this app — the "who invited you" a join
/// screen can honestly show is just the creator's address.
export function useCircleCreator(circleAddress: Address) {
  const { data, ...rest } = useCircleCreationInfo(circleAddress);
  return { data: data?.creator ?? null, ...rest };
}
