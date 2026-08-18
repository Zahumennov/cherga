"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, type Address, type Hex } from "viem";
import { CircleAbi, getTokens } from "@/lib/contracts";
import { circleUrl } from "@/lib/circle-url";
import { useCircleMembers } from "@/hooks/use-circle-members";
import { useCircleCreator } from "@/hooks/use-circle-creator";
import { useWindowLocationHash } from "@/hooks/use-window-location";
import { waitForSuccess } from "@/lib/tx";
import { errorMessage } from "@/lib/errors";

const STATE_NAMES = ["Forming", "Active", "Cancelled", "Completed"] as const;

const ROUND_WORDS: Record<number, string> = {
  [7 * 86400]: "weekly",
  [14 * 86400]: "every two weeks",
  [30 * 86400]: "monthly",
};
function roundWord(seconds: number) {
  return ROUND_WORDS[seconds] ?? `every ${Math.round(seconds / 86400)} days`;
}

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function JoinInner() {
  const circleAddress = useSearchParams().get("address") as Address | null;
  const router = useRouter();

  const hash = useWindowLocationHash();
  const secretMatch = hash.match(/s=(0x[0-9a-fA-F]+)/);
  const secret = secretMatch ? (secretMatch[1] as Hex) : null;

  const { address: account, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const tokens = getTokens(useChainId());
  const [phase, setPhase] = useState<"idle" | "joining" | "error">("idle");
  const [error, setError] = useState("");

  const { data } = useReadContracts({
    contracts: [
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "contribution" },
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "memberCount" },
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "roundDuration" },
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "fillDeadline" },
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "token" },
      { address: circleAddress ?? "0x0", abi: CircleAbi, functionName: "state" },
      {
        address: circleAddress ?? "0x0",
        abi: CircleAbi,
        functionName: "isMember",
        args: [account ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: { enabled: !!circleAddress },
  });

  const contribution = data?.[0]?.result as bigint | undefined;
  const memberCount = data?.[1]?.result as number | undefined;
  const roundDuration = data?.[2]?.result as number | undefined;
  const fillDeadline = data?.[3]?.result as bigint | undefined;
  const tokenAddress = data?.[4]?.result as Address | undefined;
  const stateIndex = data?.[5]?.result as number | undefined;
  const alreadyMember = data?.[6]?.result as boolean | undefined;

  const { members } = useCircleMembers(circleAddress ?? "0x0");
  const { data: creator } = useCircleCreator(circleAddress ?? "0x0");

  const tokenSymbol = tokens.find((t) => t.address.toLowerCase() === tokenAddress?.toLowerCase())?.symbol ?? "?";
  const amount = contribution !== undefined ? formatUnits(contribution, 18) : "…";
  const pot =
    contribution !== undefined && memberCount
      ? formatUnits(contribution * BigInt(memberCount - 1), 18)
      : "…";
  const deadlineLabel = fillDeadline ? new Date(Number(fillDeadline) * 1000).toLocaleDateString() : "…";
  const joined = members.length;
  const target = memberCount ?? 0;

  async function handleJoin() {
    if (!publicClient || !secret || !circleAddress) return;
    setError("");
    setPhase("joining");
    try {
      const joinHash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "join",
        args: [secret],
      });
      await waitForSuccess(publicClient, joinHash);
      router.push(`${circleUrl(circleAddress, "invite")}#s=${secret}`);
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
      setPhase("error");
    }
  }

  if (!circleAddress) {
    return (
      <div className="pt-[34px]">
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          No circle address in this link.
        </p>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="pt-[34px]">
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          There&rsquo;s no invite secret in this link, so it can&rsquo;t be
          used to join. Ask whoever sent it for the full link.
        </p>
      </div>
    );
  }

  const stateName = stateIndex !== undefined ? STATE_NAMES[stateIndex] : undefined;

  if (stateName && stateName !== "Forming") {
    return (
      <div className="pt-[34px]">
        <h2 className="mb-4 text-[30px] font-normal">Join this circle</h2>
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          {stateName === "Cancelled"
            ? "This circle was cancelled — it never filled up before its deadline."
            : "This circle has already started. It filled its seats before you joined."}
        </p>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="pt-[34px]">
        <h2 className="mb-4 text-[30px] font-normal">You&rsquo;re already in</h2>
        <p className="text-base text-muted-foreground">
          This wallet already joined this circle.
        </p>
      </div>
    );
  }

  const joinTerms = [
    { k: "Token", v: `${tokenSymbol} (stablecoin)` },
    { k: "Contribution", v: `$${amount} per round` },
    { k: "Members", v: `${target || "…"} people, ${target || "…"} rounds` },
    { k: "Round length", v: roundDuration ? roundWord(roundDuration) : "…" },
    { k: "Full pool", v: `$${pot} to one member each round` },
    { k: "Your total", v: `pay $${pot} · receive up to $${pot}` },
    { k: "Fills by", v: `${deadlineLabel}, or cancelled` },
  ];

  return (
    <div className="pt-[34px]">
      <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        Invitation from {creator ? truncate(creator) : "…"}
      </div>
      <h2 className="mt-3 mb-1 text-[30px] font-normal">Join this circle</h2>
      <p className="mb-[26px] text-base text-[oklch(0.45_0.012_85)]">
        These terms are fixed. Read them before you commit.
      </p>

      <div className="border-t border-[oklch(0.86_0.012_85)]">
        {joinTerms.map((row) => (
          <div
            key={row.k}
            className="grid grid-cols-1 gap-x-6 border-b border-[oklch(0.91_0.012_85)] py-3 sm:grid-cols-[210px_1fr]"
          >
            <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.48_0.012_85)] uppercase">
              {row.k}
            </div>
            <div className="font-mono text-[13.5px] tracking-[-0.035em]">{row.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-[22px]">
        <div className="mb-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Fill progress
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[22px] tracking-[-0.05em]">
            {joined} of {target || "…"}
          </span>
          <span className="text-[15px] text-[oklch(0.45_0.012_85)]">joined</span>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: target }, (_, i) => (
            <div
              key={i}
              className={
                "h-[22px] flex-1 border " +
                (i < joined ? "border-primary bg-primary" : "border-[oklch(0.85_0.012_85)]")
              }
            />
          ))}
        </div>
      </div>

      <div className="mt-[26px] border-t border-b border-[oklch(0.86_0.012_85)] py-[18px]">
        <div className="mb-2 font-mono text-[9.5px] tracking-[0.14em] text-primary uppercase">
          A gut-check
        </div>
        <p className="text-[19px] leading-[1.5]">
          Do you personally know and trust everyone in this group? If a
          member stops paying, no contract gets your money back —
          you&rsquo;d be relying on them the same way you would with cash.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          disabled={!isConnected || phase === "joining"}
          onClick={handleJoin}
          className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "joining" ? "Joining…" : "Join this circle"}
        </button>
        <Link
          href="/"
          className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary"
        >
          Not now
        </Link>
        {!isConnected && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Connect a wallet first
          </span>
        )}
      </div>

      {phase === "error" && (
        <div className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="pt-[34px] text-muted-foreground">Loading…</div>}>
      <JoinInner />
    </Suspense>
  );
}
