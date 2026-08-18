"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReadContracts, usePublicClient, useChainId, useWatchContractEvent } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";
import { getContractEventsChunked } from "@/lib/logs";
import { useCircleCreationInfo } from "@/hooks/use-circle-creator";

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
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const candidatesKey = ["circle-debt-candidates", chainId, circleAddress] as const;
  const { data: creationInfo } = useCircleCreationInfo(circleAddress);

  const { data: candidates } = useQuery({
    queryKey: candidatesKey,
    enabled: !!publicClient && !!creationInfo,
    // Same reasoning as use-circle-members.ts: expensive full scan, past
    // defaults never change, useWatchContractEvent below covers new ones.
    staleTime: 60_000,
    queryFn: async () => {
      const logs = await getContractEventsChunked(publicClient!, {
        address: circleAddress,
        abi: CircleAbi,
        eventName: "Defaulted",
        fromBlock: creationInfo!.blockNumber,
      });
      return logs.map((log) => ({
        debtor: log.args.debtor as Address,
        creditor: log.args.creditor as Address,
        round: Number(log.args.round),
      }));
    },
  });

  // closeRound() can emit new Defaulted events at any time, from anyone's
  // session — the candidate list has to react to that, not just to a
  // refetch the local caller happens to trigger.
  useWatchContractEvent({
    address: circleAddress,
    abi: CircleAbi,
    eventName: "Defaulted",
    onLogs: () => queryClient.invalidateQueries({ queryKey: candidatesKey }),
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
