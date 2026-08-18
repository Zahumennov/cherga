"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { CircleAbi, getTokens } from "@/lib/contracts";
import { circleUrl } from "@/lib/circle-url";
import { useCircleTerms } from "@/hooks/use-circle-terms";
import { useClaimable } from "@/hooks/use-claimable";
import { waitForSuccess } from "@/lib/tx";
import { errorMessage } from "@/lib/errors";

type Phase = "confirm" | "claiming" | "done" | "error";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ClaimInner() {
  const circleAddress = useSearchParams().get("address") as Address | null;
  const router = useRouter();
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const tokens = getTokens(useChainId());

  const { terms } = useCircleTerms(circleAddress ?? "0x0");
  const { claimable, refetch } = useClaimable(circleAddress ?? "0x0", account);
  const tokenSymbol = tokens.find((t) => t.address.toLowerCase() === terms?.token.toLowerCase())?.symbol ?? "?";

  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState("");
  const [claimedAmount, setClaimedAmount] = useState(0n);

  async function handleClaim() {
    if (!publicClient || !circleAddress) return;
    setError("");
    setPhase("claiming");
    try {
      const amount = claimable;
      const hash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "claim",
      });
      await waitForSuccess(publicClient, hash);
      setClaimedAmount(amount);
      await refetch();
      setPhase("done");
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
      setPhase("error");
    }
  }

  if (!circleAddress) {
    return (
      <div className="max-w-[540px] pt-11">
        <p className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          No circle address in this link.
        </p>
      </div>
    );
  }

  if (!terms) {
    return <div className="pt-11 text-muted-foreground">Loading…</div>;
  }

  const money = (n: bigint) => `$${formatUnits(n, 18)} ${tokenSymbol}`;

  if (phase === "confirm" && claimable === 0n) {
    return (
      <div className="max-w-[540px] pt-11">
        <h2 className="mb-3 text-[30px] font-normal">Nothing to claim</h2>
        <p className="mb-5 text-[17px] text-[oklch(0.35_0.012_85)]">
          This wallet has no claimable balance on this circle right now.
        </p>
        <Link
          href={circleUrl(circleAddress)}
          className="inline-block border border-[oklch(0.75_0.012_85)] px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
        >
          Back to the circle
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[540px] pt-11">
      {(phase === "confirm" || phase === "claiming") && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Your payout
          </div>
          <h2 className="mt-3 mb-2 text-[30px] font-normal">Claim {money(claimable)}</h2>
          <p className="mb-[22px] text-[17px] text-[oklch(0.35_0.012_85)]">
            This is what has accrued to you from rounds that already closed
            — it&rsquo;s yours whenever you come get it.
          </p>
          <div className="border-t border-[oklch(0.86_0.012_85)]">
            <div className="grid grid-cols-[170px_1fr] gap-x-5 border-b border-[oklch(0.91_0.012_85)] py-3">
              <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.48_0.012_85)] uppercase">
                Claimable now
              </div>
              <div className="font-mono text-[13.5px] tracking-[-0.035em]">{money(claimable)}</div>
            </div>
            <div className="grid grid-cols-[170px_1fr] gap-x-5 border-b border-[oklch(0.91_0.012_85)] py-3">
              <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.48_0.012_85)] uppercase">
                Goes to
              </div>
              <div className="font-mono text-[13.5px] tracking-[-0.035em]">
                {account ? truncate(account) : "…"} (your wallet)
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              disabled={phase !== "confirm"}
              onClick={handleClaim}
              className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "claiming" ? "Claiming…" : "Claim to my wallet"}
            </button>
            <button
              type="button"
              onClick={() => router.push(circleUrl(circleAddress))}
              disabled={phase !== "confirm"}
              className="cursor-pointer font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-destructive uppercase">
            Claim didn&rsquo;t go through
          </div>
          <h2 className="mt-3 mb-3 text-[28px] font-normal">Nothing was sent.</h2>
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
          <div className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">Claimed</div>
          <h2 className="mt-3 mb-3 text-[30px] font-normal">{money(claimedAmount)} is in your wallet.</h2>
          <Link
            href={circleUrl(circleAddress)}
            className="inline-block border border-[oklch(0.75_0.012_85)] px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
          >
            Back to the circle
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="pt-11 text-muted-foreground">Loading…</div>}>
      <ClaimInner />
    </Suspense>
  );
}
