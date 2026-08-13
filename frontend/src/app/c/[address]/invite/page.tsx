"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useReadContracts } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CircleAbi } from "@/lib/contracts";
import { useCircleMembers } from "@/hooks/use-circle-members";
import { useWindowLocationHash, useWindowOrigin } from "@/hooks/use-window-location";

const ROUND_WORDS: Record<number, string> = {
  [7 * 86400]: "weekly",
  [14 * 86400]: "every two weeks",
  [30 * 86400]: "monthly",
};

function roundWord(seconds: number) {
  return ROUND_WORDS[seconds] ?? `every ${Math.round(seconds / 86400)} days`;
}

export default function InvitePage() {
  const params = useParams<{ address: string }>();
  const circleAddress = params.address as Address;

  const [copied, setCopied] = useState(false);
  const hash = useWindowLocationHash();
  const origin = useWindowOrigin();
  const secretMatch = hash.match(/s=(0x[0-9a-fA-F]+)/);
  const secret = secretMatch ? secretMatch[1] : null;

  const { data } = useReadContracts({
    contracts: [
      { address: circleAddress, abi: CircleAbi, functionName: "contribution" },
      { address: circleAddress, abi: CircleAbi, functionName: "memberCount" },
      { address: circleAddress, abi: CircleAbi, functionName: "roundDuration" },
      { address: circleAddress, abi: CircleAbi, functionName: "fillDeadline" },
    ],
  });

  const contribution = data?.[0]?.result as bigint | undefined;
  const memberCount = data?.[1]?.result as number | undefined;
  const roundDuration = data?.[2]?.result as number | undefined;
  const fillDeadline = data?.[3]?.result as bigint | undefined;

  const { members } = useCircleMembers(circleAddress);
  const joined = members.length;
  const target = memberCount ?? 0;
  const full = target > 0 && joined >= target;

  const inviteLink = secret ? `${origin}/c/${circleAddress}/join#s=${secret}` : "";

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const amount = contribution !== undefined ? formatUnits(contribution, 18) : "…";
  // The recipient never pays into their own round (Circle.sol blocks it —
  // see IsRecipient()), so the pool is C x (N-1), not C x N.
  const pot =
    contribution !== undefined && memberCount
      ? formatUnits(contribution * BigInt(memberCount - 1), 18)
      : "…";
  const deadlineLabel = fillDeadline ? new Date(Number(fillDeadline) * 1000).toLocaleDateString() : "…";

  return (
    <div className="pt-[34px]">
      <div className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">
        Circle created
      </div>
      <h2 className="mt-3 mb-1 text-[30px] font-normal">Invite your people</h2>
      <p className="mb-7 text-base text-muted-foreground">
        {memberCount ?? "…"} members · ${amount} mUSD {roundDuration ? roundWord(roundDuration) : ""} ·
        full pool ${pot} · fills by {deadlineLabel}
      </p>

      {!secret ? (
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          No invite secret in this page&rsquo;s URL — this link was opened
          without it, so it can&rsquo;t be shared safely. Go back to the
          create flow.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3.5 border border-[oklch(0.82_0.012_85)] px-5 py-[18px]">
            <div className="font-mono text-[12.5px] tracking-[-0.04em] break-all text-[oklch(0.3_0.012_85)]">
              {inviteLink}
            </div>
            <button
              type="button"
              onClick={copyLink}
              className="cursor-pointer border border-[oklch(0.75_0.012_85)] px-3.5 py-2.5 font-mono text-[10px] tracking-[0.08em] whitespace-nowrap uppercase transition-colors hover:border-primary hover:text-primary"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="mt-7">
            <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              Joined so far
            </div>
            <div className="mt-2 mb-3 font-mono text-[28px] tracking-[-0.05em]">
              {joined} of {target || "…"} joined
            </div>
            <div className="mb-3.5 flex gap-1">
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
            <div className="text-[15px] text-muted-foreground">
              {full
                ? "The circle is full — round 1 has started."
                : `${target - joined} places left · cancelled automatically if it isn't full by ${deadlineLabel}, and nobody has paid anything by then.`}
            </div>
          </div>

          <div className="mt-[30px] border-t border-b border-[oklch(0.86_0.012_85)] py-4">
            <div className="mb-2 font-mono text-[9.5px] tracking-[0.14em] text-primary uppercase">
              Who you send this to
            </div>
            <p className="text-base text-[oklch(0.32_0.012_85)]">
              Anyone with this link can join. Only send it to people
              you&rsquo;d trust with cash. There is nothing to reverse a bad
              choice here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
