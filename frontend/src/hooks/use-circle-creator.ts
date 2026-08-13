"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { circleFactoryAddress, CircleFactoryAbi } from "@/lib/contracts";

/// No usernames anywhere in this app — the "who invited you" a join
/// screen can honestly show is just the creator's address, read from the
/// factory's CircleDeployed event.
export function useCircleCreator(circleAddress: Address) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ["circle-creator", circleAddress],
    enabled: !!publicClient,
    queryFn: async (): Promise<Address | null> => {
      const logs = await publicClient!.getContractEvents({
        address: circleFactoryAddress,
        abi: CircleFactoryAbi,
        eventName: "CircleDeployed",
        args: { circle: circleAddress },
        fromBlock: 0n,
        toBlock: "latest",
      });
      return (logs[0]?.args.creator as Address) ?? null;
    },
  });
}
