"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

export interface CircleMember {
  address: Address;
  position: number;
}

/// Reconstructs the join queue from MemberJoined events — no getter for
/// "how many joined so far" exists on Circle, by design (see docs/spec.md:
/// state is reconstructible from events, not extra storage).
export function useCircleMembers(circleAddress: Address) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const queryKey = ["circle-members", circleAddress] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!publicClient,
    queryFn: async (): Promise<CircleMember[]> => {
      const logs = await publicClient!.getContractEvents({
        address: circleAddress,
        abi: CircleAbi,
        eventName: "MemberJoined",
        fromBlock: 0n,
        toBlock: "latest",
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
