"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

/// hasContributed is per (round, member) — no bulk getter, so one call
/// per member. Fine: memberCount is capped at 20.
export function useRoundPayments(circleAddress: Address, round: number, members: Address[]) {
  const { data, isLoading } = useReadContracts({
    contracts: members.map((member) => ({
      address: circleAddress,
      abi: CircleAbi,
      functionName: "hasContributed" as const,
      args: [round, member] as const,
    })),
    query: { enabled: members.length > 0 && round > 0, refetchInterval: 4000 },
  });

  const paid = new Set<Address>(
    members.filter((_, i) => data?.[i]?.result === true),
  );

  return { paid, isLoading };
}
