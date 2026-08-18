"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useChainId } from "wagmi";
import type { Address } from "viem";
import { CircleAbi, getFromBlock } from "@/lib/contracts";
import { getContractEventsChunked } from "@/lib/logs";

export const STATE_NAMES = ["Forming", "Active", "Cancelled", "Completed"] as const;
export type CircleState = (typeof STATE_NAMES)[number];

export interface MyCircle {
  address: Address;
  position: number; // 0-indexed queue slot, from the MemberJoined event itself
  state: CircleState;
  memberCount: number;
  contribution: bigint;
  token: Address;
  roundDuration: number;
  fillDeadline: bigint;
  currentRound: number;
  claimable: bigint;
  joinedCount: number; // only meaningful while Forming
  isRecipientThisRound: boolean; // only meaningful while Active
  hasPaidThisRound: boolean;
  oweAmount: bigint;
  owedAmount: bigint;
}

/// Cherga has no backend and no per-user index of circles — this is the
/// same "reconstruct from events" rule the rest of the app follows,
/// applied to "which circles has this wallet ever joined". MemberJoined's
/// `member` is indexed, so a single chain-wide log query (no `address`
/// filter) finds every circle that names this address, not just ones
/// created in this browser session.
export function useMyCircles(account: Address | undefined) {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  return useQuery({
    queryKey: ["my-circles", chainId, account],
    enabled: !!publicClient && !!account,
    // This runs in SiteHeader, so it's live on every page, and each run
    // can fire several chunked event scans per joined circle — expensive
    // enough that 8s was hammering the public RPC into rate-limiting
    // (see lib/logs.ts). No live-update watcher exists for "did I join a
    // new circle" the way other hooks watch a single known circle, so
    // this still has to poll — just much less often.
    refetchInterval: 45_000,
    staleTime: 20_000,
    queryFn: async (): Promise<MyCircle[]> => {
      const joinLogs = await getContractEventsChunked(publicClient!, {
        abi: CircleAbi,
        eventName: "MemberJoined",
        args: { member: account! },
        fromBlock: getFromBlock(chainId),
      });

      return Promise.all(
        joinLogs.map(async (log) => {
          const address = log.address;
          const position = Number(log.args.position);

          const [state, memberCount, contribution, token, roundDuration, fillDeadline, currentRound, claimable] =
            (await Promise.all([
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "state" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "memberCount" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "contribution" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "token" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "roundDuration" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "fillDeadline" }),
              publicClient!.readContract({ address, abi: CircleAbi, functionName: "currentRound" }),
              publicClient!.readContract({
                address,
                abi: CircleAbi,
                functionName: "claimable",
                args: [account!],
              }),
            ])) as [number, number, bigint, Address, number, bigint, number, bigint];

          let joinedCount = memberCount;
          let isRecipientThisRound = false;
          let hasPaidThisRound = false;

          if (state === 0) {
            const allJoinLogs = await getContractEventsChunked(publicClient!, {
              address,
              abi: CircleAbi,
              eventName: "MemberJoined",
              fromBlock: getFromBlock(chainId),
            });
            joinedCount = allJoinLogs.length;
          } else if (state === 1) {
            const [recipient, contributed] = (await Promise.all([
              publicClient!.readContract({
                address,
                abi: CircleAbi,
                functionName: "order",
                args: [BigInt(currentRound - 1)],
              }),
              publicClient!.readContract({
                address,
                abi: CircleAbi,
                functionName: "hasContributed",
                args: [currentRound, account!],
              }),
            ])) as [Address, boolean];
            isRecipientThisRound = recipient.toLowerCase() === account!.toLowerCase();
            hasPaidThisRound = contributed;
          }

          // A debtor can only ever default to the same creditor once (see
          // use-circle-debts.ts), so Defaulted events find every pair this
          // account was ever party to in this circle; live debts() reads
          // reflect any partial repay() since. Debts outlive Forming (no
          // rounds yet, so skip) but persist through Completed.
          let oweAmount = 0n;
          let owedAmount = 0n;
          if (state !== 0) {
            const [asDebtor, asCreditor] = await Promise.all([
              getContractEventsChunked(publicClient!, {
                address,
                abi: CircleAbi,
                eventName: "Defaulted",
                args: { debtor: account },
                fromBlock: getFromBlock(chainId),
              }),
              getContractEventsChunked(publicClient!, {
                address,
                abi: CircleAbi,
                eventName: "Defaulted",
                args: { creditor: account },
                fromBlock: getFromBlock(chainId),
              }),
            ]);
            const creditors = [...new Set(asDebtor.map((l) => l.args.creditor as Address))];
            const debtors = [...new Set(asCreditor.map((l) => l.args.debtor as Address))];
            const [oweReads, owedReads] = await Promise.all([
              Promise.all(
                creditors.map(
                  (creditor) =>
                    publicClient!.readContract({
                      address,
                      abi: CircleAbi,
                      functionName: "debts",
                      args: [account!, creditor],
                    }) as Promise<bigint>,
                ),
              ),
              Promise.all(
                debtors.map(
                  (debtor) =>
                    publicClient!.readContract({
                      address,
                      abi: CircleAbi,
                      functionName: "debts",
                      args: [debtor, account!],
                    }) as Promise<bigint>,
                ),
              ),
            ]);
            oweAmount = oweReads.reduce((sum, v) => sum + v, 0n);
            owedAmount = owedReads.reduce((sum, v) => sum + v, 0n);
          }

          return {
            address,
            position,
            state: STATE_NAMES[state],
            memberCount,
            contribution,
            token,
            roundDuration,
            fillDeadline,
            currentRound,
            claimable,
            joinedCount,
            isRecipientThisRound,
            hasPaidThisRound,
            oweAmount,
            owedAmount,
          };
        }),
      );
    },
  });
}
