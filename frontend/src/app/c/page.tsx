"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CircleAbi, getTokens } from "@/lib/contracts";
import { circleUrl } from "@/lib/circle-url";
import { useCircleTerms, STATE_NAMES } from "@/hooks/use-circle-terms";
import { useCircleMembers } from "@/hooks/use-circle-members";
import { useCircleDebts } from "@/hooks/use-circle-debts";
import { useRoundPayments } from "@/hooks/use-round-payments";
import { useClaimable } from "@/hooks/use-claimable";
import { useChainTime } from "@/hooks/use-chain-time";
import { waitForSuccess } from "@/lib/tx";
import { errorMessage } from "@/lib/errors";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function nameFor(address: Address, account: Address | undefined) {
  return account && address.toLowerCase() === account.toLowerCase() ? "You" : truncate(address);
}

function BackLink() {
  return (
    <Link
      href="/circles"
      className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary"
    >
      &larr; My circles
    </Link>
  );
}

function DashboardInner() {
  const circleAddress = useSearchParams().get("address") as Address | null;
  const { address: account, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const tokens = getTokens(useChainId());
  const { writeContractAsync } = useWriteContract();

  const { terms, isLoading: termsLoading, refetch: refetchTerms } = useCircleTerms(circleAddress ?? "0x0");
  const { members, loading: membersLoading } = useCircleMembers(circleAddress ?? "0x0");
  const { debts } = useCircleDebts(circleAddress ?? "0x0");
  const { claimable, refetch: refetchClaimable } = useClaimable(circleAddress ?? "0x0", account);

  const memberAddresses = members.map((m) => m.address);
  const { paid } = useRoundPayments(circleAddress ?? "0x0", terms?.currentRound ?? 0, memberAddresses);

  const { data: roundData } = useReadContract({
    address: circleAddress ?? "0x0",
    abi: CircleAbi,
    functionName: "rounds",
    args: [terms?.currentRound ?? 0],
    query: { enabled: !!terms && !!circleAddress, refetchInterval: 4000 },
  });
  const collected = (roundData as readonly [bigint, boolean] | undefined)?.[0] ?? 0n;

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const now = useChainTime();

  async function handleCloseRound() {
    if (!publicClient || !circleAddress) return;
    setCloseError("");
    setClosing(true);
    try {
      const hash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "closeRound",
      });
      await waitForSuccess(publicClient, hash);
      await Promise.all([refetchTerms(), refetchClaimable()]);
    } catch (err) {
      setCloseError(errorMessage(err, "Couldn't close the round."));
    } finally {
      setClosing(false);
    }
  }

  if (!circleAddress) {
    return (
      <div className="max-w-[460px] pt-[34px]">
        <BackLink />
        <p className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          No circle address in this link.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-[460px] pt-[34px]">
        <BackLink />
        <h2 className="mt-6 mb-2.5 text-[26px] font-normal">Connect a wallet to see this circle</h2>
        <p className="text-base text-muted-foreground">
          There is no account and no password. Cherga reads the circle
          straight from the chain, and your wallet is how it knows which
          member you are.
        </p>
      </div>
    );
  }

  if (termsLoading || membersLoading || !terms) {
    return (
      <div className="pt-[34px]">
        <BackLink />
        <div className="flex items-center gap-3.5 py-[56px]">
          <div className="h-[13px] w-[13px] animate-spin rounded-full border-[1.5px] border-[oklch(0.82_0.012_85)] border-t-primary" />
          <span className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
            Reading circle history from chain…
          </span>
        </div>
      </div>
    );
  }

  const stateName = STATE_NAMES[terms.state];

  if (stateName === "Forming") {
    return (
      <div className="pt-[34px]">
        <BackLink />
        <p className="mt-4 text-base text-muted-foreground">
          This circle hasn&rsquo;t started yet — it&rsquo;s still filling
          its seats.{" "}
          <Link href={circleUrl(circleAddress, "invite")} className="text-primary">
            See invite progress
          </Link>
          .
        </p>
      </div>
    );
  }

  if (stateName === "Cancelled") {
    return (
      <div className="pt-[34px]">
        <BackLink />
        <p className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          This circle was cancelled — it never filled up before its
          deadline. Nobody paid anything, so there is nothing to settle.
        </p>
      </div>
    );
  }

  const completed = stateName === "Completed";
  const tokenSymbol = tokens.find((t) => t.address.toLowerCase() === terms.token.toLowerCase())?.symbol ?? "?";
  const money = (n: bigint) => `$${formatUnits(n, 18)} ${tokenSymbol}`;

  const recipient = members.find((m) => m.position === terms.currentRound - 1);
  const isRecipient = !completed && !!account && recipient?.address.toLowerCase() === account.toLowerCase();
  const iPaid = !!account && paid.has(account as Address);

  const expected = terms.contribution * BigInt(terms.memberCount - 1);
  const shortfall = expected > collected ? expected - collected : 0n;
  const unpaid = members.filter((m) => m.address !== recipient?.address && !paid.has(m.address));

  const roundClosable = !completed && (now >= Number(terms.roundEnd) || collected >= expected);

  const myDebts = debts.filter((d) => account && d.debtor.toLowerCase() === account.toLowerCase());
  const owedToMe = debts.filter((d) => account && d.creditor.toLowerCase() === account.toLowerCase());

  const showPay = !completed && !isRecipient && !iPaid;
  const showClaim = claimable > 0n;

  let youText: string;
  if (completed) {
    youText = `The circle is finished. You paid in and received up to ${money(expected)} across the whole circle.`;
  } else if (isRecipient) {
    youText =
      shortfall > 0n
        ? `This round is yours. ${money(collected)} has been collected so far — ${unpaid.map((u) => nameFor(u.address, account as Address)).join(" and ")} ${unpaid.length === 1 ? "hasn't" : "haven't"} paid yet. Close the round once it's ready to turn what's collected into a claimable payout.`
        : `This round is yours and everyone has paid. Close the round to make ${money(collected)} claimable.`;
  } else if (!iPaid) {
    youText = `You owe ${money(terms.contribution)} for round ${terms.currentRound}. It goes to ${recipient ? nameFor(recipient.address, account as Address) : "…"}.`;
  } else {
    youText = `You paid your ${money(terms.contribution)} for round ${terms.currentRound}. Nothing else is due until the next round.`;
  }

  return (
    <div className="pt-[30px]">
      <BackLink />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-normal">Circle {truncate(circleAddress)}</h2>
          <div className="mt-1.5 font-mono text-[11px] tracking-[-0.02em] text-muted-foreground">
            {terms.memberCount} members · {money(terms.contribution)} · pool {money(expected)}
          </div>
        </div>
        <div className="border border-[oklch(0.82_0.012_85)] px-2.5 py-1.5 font-mono text-[10px] tracking-[0.1em] text-foreground/70 uppercase">
          {stateName}
        </div>
      </div>

      {/* THE QUEUE */}
      <div className="mt-7 border-t border-[oklch(0.86_0.012_85)] pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            The queue · payout order
          </div>
          <div className="font-mono text-[9.5px] text-muted-foreground">
            paid out · receiving now · waiting
          </div>
        </div>
        <div className="mt-3.5 flex overflow-x-auto border-t border-b border-[oklch(0.88_0.012_85)]">
          {members.map((m) => {
            const roundOfMember = m.position + 1;
            const past = completed || roundOfMember < terms.currentRound;
            const current = !completed && roundOfMember === terms.currentRound;
            const relToMe = debts.find(
              (d) =>
                (d.debtor === m.address && account && d.creditor.toLowerCase() === account.toLowerCase()) ||
                (d.creditor === m.address && account && d.debtor.toLowerCase() === account.toLowerCase()),
            );
            let relLabel = "";
            if (relToMe && account) {
              relLabel =
                relToMe.creditor.toLowerCase() === account.toLowerCase()
                  ? `owes you ${formatUnits(relToMe.amount, 18)}`
                  : `you owe ${formatUnits(relToMe.amount, 18)}`;
            }
            return (
              <div
                key={m.address}
                className={
                  "min-w-[96px] flex-1 border-r border-[oklch(0.9_0.012_85)] px-3 pt-3.5 pb-3 " +
                  (current ? "bg-[oklch(0.965_0.014_320)]" : "")
                }
                style={current ? { borderTop: "2px solid var(--primary)" } : { borderTop: "2px solid transparent" }}
              >
                <div
                  className={"font-mono text-[9.5px] tracking-[0.04em] " + (current ? "text-primary" : "text-[oklch(0.62_0.012_85)]")}
                >
                  {String(m.position + 1).padStart(2, "0")}
                </div>
                <div className={"mt-1 text-base " + (past ? "text-[oklch(0.6_0.012_85)]" : "")}>
                  {nameFor(m.address, account as Address)}
                </div>
                <div
                  className={
                    "mt-1.5 font-mono text-[9px] tracking-[0.06em] uppercase " +
                    (current ? "text-primary" : "text-[oklch(0.58_0.012_85)]")
                  }
                >
                  {past ? "paid out" : current ? "receiving now" : "waiting"}
                </div>
                <div
                  className={
                    "mt-1 min-h-[12px] font-mono text-[9px] " +
                    (relToMe && account && relToMe.creditor.toLowerCase() === account.toLowerCase()
                      ? "text-[oklch(0.42_0.09_150)]"
                      : "text-[oklch(0.48_0.13_30)]")
                  }
                >
                  {relLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!completed && (
        <div className="mt-[30px] grid grid-cols-1 gap-x-10 gap-y-6 border-t border-[oklch(0.86_0.012_85)] pt-4 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
              Round {terms.currentRound} of {terms.memberCount}
            </div>
            <div className="mt-2 mb-1 text-[22px]">
              Paying {recipient ? nameFor(recipient.address, account as Address) : "…"}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {now >= Number(terms.roundEnd)
                ? "past its deadline — ready to close"
                : `closes ${new Date(Number(terms.roundEnd) * 1000).toLocaleDateString()}`}
            </div>
            {roundClosable && (
              <button
                type="button"
                onClick={handleCloseRound}
                disabled={closing}
                className="mt-2.5 cursor-pointer border border-[oklch(0.75_0.012_85)] px-3.5 py-2 font-mono text-[10px] tracking-[0.06em] uppercase transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {closing ? "Closing…" : "Close round"}
              </button>
            )}
            {closeError && (
              <div className="mt-2 text-[13px] text-destructive">{closeError}</div>
            )}
          </div>
          <div>
            <div className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
              Collected so far
            </div>
            <div className="mt-2 mb-2 font-mono text-[24px] tracking-[-0.05em]">
              {formatUnits(collected, 18)} of {formatUnits(expected, 18)}
            </div>
            <div className="relative h-1.5 bg-[oklch(0.9_0.012_85)]">
              <div
                className="absolute top-0 left-0 h-full bg-primary"
                style={{ width: `${expected > 0n ? Math.min(100, Number((collected * 100n) / expected)) : 0}%` }}
              />
            </div>
            <div className="mt-[7px] font-mono text-[10px] text-muted-foreground">
              {shortfall > 0n ? `${unpaid.length} contribution${unpaid.length === 1 ? "" : "s"} still missing` : "Everyone has paid"}
            </div>
          </div>
        </div>
      )}

      {/* WHERE YOU STAND */}
      <div className="mt-[30px] border border-primary bg-[oklch(0.965_0.014_320)] px-[22px] py-5">
        <div className="mb-2.5 font-mono text-[9.5px] tracking-[0.14em] text-primary uppercase">
          Where you stand
        </div>
        <p className="mb-4 text-[19px] leading-[1.5]">{youText}</p>
        <div className="flex flex-wrap gap-2.5">
          {showPay && (
            <Link
              href={circleUrl(circleAddress, "contribute")}
              className="border border-primary bg-primary px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
            >
              Pay {money(terms.contribution)}
            </Link>
          )}
          {showClaim && (
            <Link
              href={circleUrl(circleAddress, "claim")}
              className="border border-primary bg-primary px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
            >
              Claim {money(claimable)}
            </Link>
          )}
        </div>
      </div>

      {/* ROSTER */}
      {!completed && (
        <div className="mt-[30px] border-t border-[oklch(0.86_0.012_85)] pt-4">
          <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            This round, member by member
          </div>
          {members
            .filter((m) => m.address !== recipient?.address)
            .map((m) => {
              const has = paid.has(m.address);
              return (
                <div
                  key={m.address}
                  className="grid grid-cols-[26px_1fr_auto_auto] items-baseline gap-3.5 border-b border-[oklch(0.91_0.012_85)] py-2.5"
                >
                  <div className="font-mono text-[10.5px] text-[oklch(0.62_0.012_85)]">
                    {String(m.position + 1).padStart(2, "0")}
                  </div>
                  <div>{nameFor(m.address, account as Address)}</div>
                  <div className="min-w-[80px] text-right font-mono text-[12.5px] tracking-[-0.035em] text-[oklch(0.4_0.012_85)]">
                    {money(terms.contribution)}
                  </div>
                  <div
                    className={
                      "font-mono text-[9.5px] tracking-[0.06em] uppercase " +
                      (has ? "text-[oklch(0.45_0.012_85)]" : "text-[oklch(0.48_0.13_30)]")
                    }
                  >
                    {has ? "paid" : "not yet"}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* DEBTS */}
      <div className="mt-[30px] grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <div className="border-t border-[oklch(0.86_0.012_85)] pt-3.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            You owe, from past rounds
          </div>
          {myDebts.length === 0 ? (
            <div className="py-3 text-base text-muted-foreground">
              Nothing. You&rsquo;ve paid every round you were due.
            </div>
          ) : (
            <>
              {myDebts.map((d) => (
                <div key={`${d.debtor}-${d.creditor}`} className="border-b border-[oklch(0.91_0.012_85)] py-3">
                  <div className="text-[17px]">
                    You owe {nameFor(d.creditor, account as Address)} {formatUnits(d.amount, 18)} {tokenSymbol}.
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                    Round {d.round} · no deadline
                  </div>
                </div>
              ))}
              <Link
                href={circleUrl(circleAddress, "repay")}
                className="mt-3.5 inline-block cursor-pointer border border-[oklch(0.75_0.012_85)] px-3.5 py-2.5 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
              >
                Pay back a debt
              </Link>
            </>
          )}
        </div>
        <div>
          <div className="border-t border-[oklch(0.86_0.012_85)] pt-3.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            Owed to you, from past rounds
          </div>
          {owedToMe.length === 0 ? (
            <div className="py-3 text-base text-muted-foreground">
              Nothing. Every round you were paid came in full.
            </div>
          ) : (
            owedToMe.map((d) => (
              <div key={`${d.debtor}-${d.creditor}`} className="border-b border-[oklch(0.91_0.012_85)] py-3">
                <div className="text-[17px]">
                  {nameFor(d.debtor, account as Address)} owes you {formatUnits(d.amount, 18)} {tokenSymbol}.
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                  Round {d.round}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-[30px] border-t border-[oklch(0.86_0.012_85)] pt-3.5">
        <p className="text-[15px] text-muted-foreground">
          Payments here aren&rsquo;t insured or reversible. If someone
          doesn&rsquo;t pay, the round still closes and the shortfall
          becomes their personal debt to that round&rsquo;s recipient — on
          the chain, permanently, payable whenever they choose to.
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="pt-[34px] text-muted-foreground">Loading…</div>}>
      <DashboardInner />
    </Suspense>
  );
}
