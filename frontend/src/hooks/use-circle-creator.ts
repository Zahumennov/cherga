"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { getCircleFactoryAddress, getFromBlock, CircleFactoryAbi } from "@/lib/contracts";
import { getContractEventsChunked } from "@/lib/logs";

/// No usernames anywhere in this app — the "who invited you" a join
/// screen can honestly show is just the creator's address, read from the
/// factory's CircleDeployed event.
export function useCircleCreator(circleAddress: Address) {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  return useQuery({
    queryKey: ["circle-creator", chainId, circleAddress],
    enabled: !!publicClient,
    queryFn: async (): Promise<Address | null> => {
      const logs = await getContractEventsChunked(publicClient!, {
        address: getCircleFactoryAddress(chainId),
        abi: CircleFactoryAbi,
        eventName: "CircleDeployed",
        args: { circle: circleAddress },
        fromBlock: getFromBlock(chainId),
      });
      return (logs[0]?.args.creator as Address) ?? null;
    },
  });
}
