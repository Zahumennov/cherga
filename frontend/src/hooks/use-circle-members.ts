"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useChainId, useWatchContractEvent } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";
import { getContractEventsChunked } from "@/lib/logs";
import { useCircleCreationInfo } from "@/hooks/use-circle-creator";

export interface CircleMember {
  address: Address;
  position: number;
}

/// Reconstructs the join queue from MemberJoined events — no getter for
/// "how many joined so far" exists on Circle, by design (see docs/spec.md:
/// state is reconstructible from events, not extra storage).
export function useCircleMembers(circleAddress: Address) {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const queryKey = ["circle-members", chainId, circleAddress] as const;
  // The circle's own birth block, not the factory's — every circle scan
  // that's specific to one circle should start there, not from however
  // far back the factory happens to have been deployed.
  const { data: creationInfo } = useCircleCreationInfo(circleAddress);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!publicClient && !!creationInfo,
    // A full re-scan is expensive (see lib/logs.ts) and past joins never
    // change — useWatchContractEvent below already invalidates this the
    // moment a real MemberJoined lands, so there's nothing to gain from
    // TanStack Query's default refetch-on-remount/refocus behavior.
    staleTime: 60_000,
    queryFn: async (): Promise<CircleMember[]> => {
      const logs = await getContractEventsChunked(publicClient!, {
        address: circleAddress,
        abi: CircleAbi,
        eventName: "MemberJoined",
        fromBlock: creationInfo!.blockNumber,
      });
      return logs
        .map((log) => ({
          address: log.args.member as Address,
          position: Number(log.args.position),
        }))
        .sort((a, b) => a.position - b.position);
    },
  });

  useWatchContractEvent({
    address: circleAddress,
    abi: CircleAbi,
    eventName: "MemberJoined",
    onLogs: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { members: data ?? [], loading: isLoading, refetch };
}
