"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { CircleAbi } from "@/lib/contracts";

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

  return useQuery({
    queryKey: ["my-circles", account],
    enabled: !!publicClient && !!account,
    refetchInterval: 8000,
    queryFn: async (): Promise<MyCircle[]> => {
      const joinLogs = await publicClient!.getContractEvents({
        abi: CircleAbi,
        eventName: "MemberJoined",
        args: { member: account! },
        fromBlock: 0n,
        toBlock: "latest",
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
            const allJoinLogs = await publicClient!.getContractEvents({
              address,
              abi: CircleAbi,
              eventName: "MemberJoined",
              fromBlock: 0n,
              toBlock: "latest",
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
              publicClient!.getContractEvents({
                address,
                abi: CircleAbi,
                eventName: "Defaulted",
                args: { debtor: account },
                fromBlock: 0n,
                toBlock: "latest",
              }),
              publicClient!.getContractEvents({
                address,
                abi: CircleAbi,
                eventName: "Defaulted",
                args: { creditor: account },
                fromBlock: 0n,
                toBlock: "latest",
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
