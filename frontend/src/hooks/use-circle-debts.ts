"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContracts, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

export interface Debt {
  debtor: Address;
  creditor: Address;
  round: number;
  amount: bigint; // current remaining amount, read live — not the original default
}

/// A debtor can only ever default to the same creditor once (each round's
/// recipient is a different member — order is a permutation), so a
/// Defaulted event uniquely identifies a debtor/creditor pair. Events find
/// *which* pairs ever existed; the actual remaining amount is always read
/// fresh from debts() so partial repay() calls are reflected correctly.
export function useCircleDebts(circleAddress: Address) {
  const publicClient = usePublicClient();

  const { data: candidates } = useQuery({
    queryKey: ["circle-debt-candidates", circleAddress],
    enabled: !!publicClient,
    queryFn: async () => {
      const logs = await publicClient!.getContractEvents({
        address: circleAddress,
        abi: CircleAbi,
        eventName: "Defaulted",
        fromBlock: 0n,
        toBlock: "latest",
      });
      return logs.map((log) => ({
        debtor: log.args.debtor as Address,
        creditor: log.args.creditor as Address,
        round: Number(log.args.round),
      }));
    },
  });

  const { data: amounts } = useReadContracts({
    contracts: (candidates ?? []).map((c) => ({
      address: circleAddress,
      abi: CircleAbi,
      functionName: "debts" as const,
      args: [c.debtor, c.creditor] as const,
    })),
    query: { enabled: !!candidates && candidates.length > 0, refetchInterval: 4000 },
  });

  const debts: Debt[] = (candidates ?? [])
    .map((c, i) => ({ ...c, amount: (amounts?.[i]?.result as bigint | undefined) ?? 0n }))
    .filter((d) => d.amount > 0n);

  return { debts };
}
