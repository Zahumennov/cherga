"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

export function useClaimable(circleAddress: Address, account: Address | undefined) {
  const { data, refetch } = useReadContract({
    address: circleAddress,
    abi: CircleAbi,
    functionName: "claimable",
    args: [account ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!account, refetchInterval: 4000 },
  });

  return { claimable: (data as bigint | undefined) ?? 0n, refetch };
}
