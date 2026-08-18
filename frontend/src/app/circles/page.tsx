"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { formatUnits } from "viem";
import { getTokens } from "@/lib/contracts";
import { circleUrl } from "@/lib/circle-url";
import { useMyCircles, type MyCircle } from "@/hooks/use-my-circles";
import { useChainTime } from "@/hooks/use-chain-time";

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

function BackLink() {
  return (
    <Link
      href="/"
      className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary"
    >
      &larr; Back
    </Link>
  );
}

function daysLeft(deadline: bigint, now: number) {
  const secs = Number(deadline) - now;
  if (secs <= 0) return "any moment";
  const d = Math.ceil(secs / 86400);
  return d === 1 ? "1 day" : `${d} days`;
}

function rankOf(c: MyCircle) {
  if (c.state === "Active" && c.isRecipientThisRound && c.claimable > 0n) return 0;
  if (c.state === "Active" && !c.isRecipientThisRound && !c.hasPaidThisRound) return 1;
  if (c.oweAmount > 0n) return 2;
  return 3;
}

function actionFor(c: MyCircle, symbol: string) {
  if (c.state === "Cancelled") return { label: "cancelled", urgent: false };
  if (c.state === "Forming") return { label: `${c.joinedCount} of ${c.memberCount} joined`, urgent: false };
  if (c.state === "Active" && c.isRecipientThisRound && c.claimable > 0n)
    return { label: `claim $${formatUnits(c.claimable, 18)} ${symbol} — your turn`, urgent: true };
  if (c.state === "Active" && !c.isRecipientThisRound && !c.hasPaidThisRound)
    return { label: `pay $${formatUnits(c.contribution, 18)} ${symbol}`, urgent: true };
  if (c.oweAmount > 0n) return { label: `you owe $${formatUnits(c.oweAmount, 18)} ${symbol}`, urgent: false };
  if (c.owedAmount > 0n) return { label: `owed $${formatUnits(c.owedAmount, 18)} ${symbol}`, urgent: false };
  if (c.state === "Completed") return { label: "settled", urgent: false };
  return { label: "nothing due", urgent: false };
}

export default function MyCirclesPage() {
  const router = useRouter();
  const { address: account, isConnected } = useAccount();
  const chainId = useChainId();
  const tokens = getTokens(chainId);
  const { data: circles, isLoading } = useMyCircles(account);
  const now = useChainTime();

  if (!isConnected) {
    return (
      <div className="max-w-[460px] pt-[34px]">
        <BackLink />
        <h2 className="mt-6 mb-2.5 text-[26px] font-normal">
          Connect a wallet to see your circles
        </h2>
        <p className="text-base text-[oklch(0.45_0.012_85)]">
          Your circles aren&rsquo;t stored anywhere by Cherga. They&rsquo;re
          found by looking up your address on the chain, so there&rsquo;s
          nothing to show until a wallet is connected.
        </p>
      </div>
    );
  }

  if (isLoading || !circles) {
    return (
      <div className="pt-[34px]">
        <BackLink />
        <div className="flex items-center gap-3.5 py-[56px]">
          <div className="h-[13px] w-[13px] animate-spin rounded-full border-[1.5px] border-[oklch(0.82_0.012_85)] border-t-primary" />
          <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
            Looking for circles that name your address…
          </span>
        </div>
      </div>
    );
  }

  if (circles.length === 0) {
    return (
      <div className="pt-[34px]">
        <BackLink />
        <h2 className="mt-4 mb-2.5 text-[30px] font-normal">No circles yet</h2>
        <p className="mb-2 max-w-[560px] text-[17px] text-[oklch(0.38_0.012_85)]">
          This wallet hasn&rsquo;t joined a circle. When you create one or
          open an invite link, it will appear here — found by your address,
          so it shows up on any device or browser you connect from.
        </p>
        <div className="mb-[26px] font-mono text-[10px] text-[oklch(0.58_0.012_85)]">
          Checked as {truncate(account!)}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/create"
            className="border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
          >
            Create a circle
          </Link>
          <Link
            href="/"
            className="border border-[oklch(0.75_0.012_85)] px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
          >
            I have an invite link
          </Link>
        </div>
      </div>
    );
  }

  const needsYou = circles.filter((c) => rankOf(c) < 3);

  const groups = [
    { head: "Needs you now", test: (c: MyCircle) => rankOf(c) < 2 },
    { head: "You owe someone", test: (c: MyCircle) => rankOf(c) === 2 },
    { head: "Waiting · nothing due", test: (c: MyCircle) => rankOf(c) === 3 && c.state === "Active" },
    { head: "Still filling", test: (c: MyCircle) => c.state === "Forming" },
    { head: "Finished", test: (c: MyCircle) => c.state === "Completed" || c.state === "Cancelled" },
  ]
    .map((g) => ({ ...g, rows: circles.filter(g.test) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="pt-[34px]">
      <BackLink />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-normal">My circles</h2>
          <div className="mt-1.5 font-mono text-[10px] text-[oklch(0.55_0.012_85)]">
            {circles.length} {circles.length === 1 ? "circle" : "circles"} found for{" "}
            {truncate(account!)} · {needsYou.length} need you
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.head} className="mt-[30px]">
          <div className="flex items-baseline justify-between gap-3 border-b border-[oklch(0.82_0.012_85)] pb-[7px]">
            <div
              className={
                "font-mono text-[9.5px] tracking-[0.14em] uppercase " +
                (g.head === "Needs you now" ? "text-primary" : "text-muted-foreground")
              }
            >
              {g.head}
            </div>
            <div className="font-mono text-[9px] tracking-[0.06em] text-[oklch(0.6_0.012_85)] uppercase">
              {g.rows.length} {g.rows.length === 1 ? "circle" : "circles"}
            </div>
          </div>

          {g.rows.map((c) => {
            const symbol = tokens.find((t) => t.address.toLowerCase() === c.token.toLowerCase())?.symbol ?? "?";
            const action = actionFor(c, symbol);
            const finished = c.state === "Completed" || c.state === "Cancelled";
            return (
              <button
                key={c.address}
                type="button"
                onClick={() => router.push(circleUrl(c.address))}
                className={
                  "block w-full cursor-pointer border-b border-[oklch(0.91_0.012_85)] border-l-2 px-4 py-4 text-left transition-opacity " +
                  (action.urgent ? "border-l-primary" : "border-l-transparent") +
                  (finished ? " opacity-70" : "")
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
                  <div className="text-xl">Circle {truncate(c.address)}</div>
                  <div
                    className={
                      "font-mono tracking-[0.05em] whitespace-nowrap uppercase " +
                      (action.urgent
                        ? "bg-primary px-[9px] py-[5px] text-[10.5px] text-primary-foreground"
                        : "py-[5px] text-[9.5px] text-[oklch(0.55_0.012_85)]")
                    }
                  >
                    {action.label}
                  </div>
                </div>
                <div className="mt-[7px] font-mono text-[10.5px] text-[oklch(0.5_0.012_85)]">
                  {c.memberCount} members · ${formatUnits(c.contribution, 18)} {symbol}{" "}
                  {roundWord(c.roundDuration)}
                </div>
                <div className="mt-[9px] flex flex-wrap gap-x-3.5 gap-y-1">
                  <div className="font-mono text-[9.5px] tracking-[0.05em] text-[oklch(0.55_0.012_85)] uppercase">
                    {c.state === "Forming"
                      ? `you are ${c.position + 1} in line`
                      : `your place ${c.position + 1} of ${c.memberCount}`}
                  </div>
                  <div className="font-mono text-[9.5px] tracking-[0.05em] text-[oklch(0.55_0.012_85)] uppercase">
                    {c.state === "Active"
                      ? `round ${c.currentRound} of ${c.memberCount}`
                      : c.state === "Forming"
                        ? `fills in ${daysLeft(c.fillDeadline, now)}`
                        : c.state === "Completed"
                          ? `all ${c.memberCount} rounds done`
                          : "never started"}
                  </div>
                </div>
                <div className="mt-2 font-mono text-[9px] text-[oklch(0.66_0.012_85)]">
                  {c.address}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-8 border-t border-border pt-3.5">
        <p className="text-[15px] text-[oklch(0.45_0.012_85)]">
          Circles are found by scanning the chain for your address — nothing
          is stored off-chain. Debts between two people outlive the circle
          they came from, so a completed or cancelled circle still shows
          here while anything is outstanding.
        </p>
      </div>
    </div>
  );
}
