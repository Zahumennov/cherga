"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CircleAbi, getTokens } from "@/lib/contracts";
import { circleUrl } from "@/lib/circle-url";
import { erc20Abi } from "@/lib/erc20";
import { useCircleTerms } from "@/hooks/use-circle-terms";
import { useCircleMembers } from "@/hooks/use-circle-members";
import { waitForSuccess } from "@/lib/tx";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type Phase = "confirm" | "approving" | "paying" | "done" | "error";

function ContributeInner() {
  const circleAddress = useSearchParams().get("address") as Address | null;
  const router = useRouter();
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const tokens = getTokens(useChainId());

  const { terms } = useCircleTerms(circleAddress ?? "0x0");
  const { members } = useCircleMembers(circleAddress ?? "0x0");
  const recipient = terms ? members.find((m) => m.position === terms.currentRound - 1) : undefined;
  const tokenSymbol = tokens.find((t) => t.address.toLowerCase() === terms?.token.toLowerCase())?.symbol ?? "?";

  const { data: roundData, refetch: refetchRound } = useReadContract({
    address: circleAddress ?? "0x0",
    abi: CircleAbi,
    functionName: "rounds",
    args: [terms?.currentRound ?? 0],
    query: { enabled: !!terms && !!circleAddress },
  });
  const collected = (roundData as readonly [bigint, boolean] | undefined)?.[0] ?? 0n;
  const expected = terms ? terms.contribution * BigInt(terms.memberCount - 1) : 0n;

  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState("");

  async function handlePay() {
    if (!publicClient || !terms || !account || !circleAddress) return;
    setError("");
    try {
      const allowance = (await publicClient.readContract({
        address: terms.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, circleAddress],
      })) as bigint;

      if (allowance < terms.contribution) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: terms.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [circleAddress, terms.contribution],
        });
        await waitForSuccess(publicClient, approveHash);
      }

      setPhase("paying");
      const payHash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "contribute",
      });
      await waitForSuccess(publicClient, payHash);
      await refetchRound();
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  if (!circleAddress) {
    return (
      <div className="max-w-[520px] pt-11">
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          No circle address in this link.
        </p>
      </div>
    );
  }

  if (!terms) {
    return <div className="pt-[44px] text-muted-foreground">Loading…</div>;
  }

  const money = (n: bigint) => `$${formatUnits(n, 18)} ${tokenSymbol}`;
  const recipientName = recipient
    ? account && recipient.address.toLowerCase() === account.toLowerCase()
      ? "you"
      : truncate(recipient.address)
    : "…";

  const payRows = [
    { k: "Amount", v: money(terms.contribution) },
    { k: "Round", v: `${terms.currentRound} of ${terms.memberCount}` },
    { k: "Goes to", v: recipient ? `${truncate(recipient.address)} · position ${recipient.position + 1}` : "…" },
    { k: "After you pay", v: `${formatUnits(collected + terms.contribution, 18)} of ${formatUnits(expected, 18)} collected` },
  ];

  return (
    <div className="max-w-[520px] pt-11">
      {(phase === "confirm" || phase === "approving" || phase === "paying") && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Round {terms.currentRound} · contribution
          </div>
          <h2 className="mt-3 mb-[22px] text-[30px] font-normal">
            Pay {money(terms.contribution)} to {recipientName}
          </h2>
          <div className="border-t border-[oklch(0.86_0.012_85)]">
            {payRows.map((row) => (
              <div
                key={row.k}
                className="grid grid-cols-[150px_1fr] gap-x-5 border-b border-[oklch(0.91_0.012_85)] py-3"
              >
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.48_0.012_85)] uppercase">
                  {row.k}
                </div>
                <div className="font-mono text-[13.5px] tracking-[-0.035em]">{row.v}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-base text-[oklch(0.4_0.012_85)]">
            Your wallet will ask you to approve spending, then confirm the
            payment — two transactions the first time, one after that once
            the allowance is already set.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              disabled={phase !== "confirm"}
              onClick={handlePay}
              className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "approving" ? "Approving…" : phase === "paying" ? "Paying…" : "Confirm and pay"}
            </button>
            <button
              type="button"
              onClick={() => router.push(circleUrl(circleAddress))}
              disabled={phase !== "confirm"}
              className="cursor-pointer font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-destructive uppercase">
            Payment didn&rsquo;t go through
          </div>
          <h2 className="mt-3 mb-3 text-[28px] font-normal">Nothing was paid.</h2>
          <p className="mb-5 text-[17px] text-[oklch(0.35_0.012_85)]">{error}</p>
          <div className="flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={() => setPhase("confirm")}
              className="cursor-pointer border border-primary bg-primary px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase"
            >
              Try again
            </button>
            <Link
              href={circleUrl(circleAddress)}
              className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary"
            >
              Back to the circle
            </Link>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">Paid</div>
          <h2 className="mt-3 mb-3 text-[30px] font-normal">
            {money(terms.contribution)} paid to {recipientName}.
          </h2>
          <p className="mb-5 text-[17px] text-[oklch(0.35_0.012_85)]">
            Round {terms.currentRound} now has {formatUnits(collected, 18)} of{" "}
            {formatUnits(expected, 18)} {tokenSymbol} collected.
          </p>
          <Link
            href={circleUrl(circleAddress)}
            className="inline-block cursor-pointer border border-[oklch(0.75_0.012_85)] px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
          >
            Back to the circle
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ContributePage() {
  return (
    <Suspense fallback={<div className="pt-[44px] text-muted-foreground">Loading…</div>}>
      <ContributeInner />
    </Suspense>
  );
}
