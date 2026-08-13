"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

export interface CircleTerms {
  token: Address;
  contribution: bigint;
  memberCount: number;
  roundDuration: number;
  fillDeadline: bigint;
  state: number; // 0 Forming, 1 Active, 2 Cancelled, 3 Completed
  currentRound: number;
  roundEnd: bigint;
}

export const STATE_NAMES = ["Forming", "Active", "Cancelled", "Completed"] as const;

/// The circle's own terms + live state — polled rather than watched for
/// specific events, since almost every write action (contribute,
/// closeRound, claim, repay) can move one of these fields.
export function useCircleTerms(circleAddress: Address) {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: circleAddress, abi: CircleAbi, functionName: "token" },
      { address: circleAddress, abi: CircleAbi, functionName: "contribution" },
      { address: circleAddress, abi: CircleAbi, functionName: "memberCount" },
      { address: circleAddress, abi: CircleAbi, functionName: "roundDuration" },
      { address: circleAddress, abi: CircleAbi, functionName: "fillDeadline" },
      { address: circleAddress, abi: CircleAbi, functionName: "state" },
      { address: circleAddress, abi: CircleAbi, functionName: "currentRound" },
      { address: circleAddress, abi: CircleAbi, functionName: "roundEnd" },
    ],
    query: { refetchInterval: 4000 },
  });

  const ok = data?.every((d) => d.status === "success") ?? false;
  const terms: CircleTerms | undefined = ok
    ? {
        token: data![0].result as Address,
        contribution: data![1].result as bigint,
        memberCount: data![2].result as number,
        roundDuration: data![3].result as number,
        fillDeadline: data![4].result as bigint,
        state: data![5].result as number,
        currentRound: data![6].result as number,
        roundEnd: data![7].result as bigint,
      }
    : undefined;

  return { terms, isLoading, refetch };
}
