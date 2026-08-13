"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { CircleAbi, tokens } from "@/lib/contracts";
import { erc20Abi } from "@/lib/erc20";
import { useCircleTerms } from "@/hooks/use-circle-terms";
import { useCircleDebts } from "@/hooks/use-circle-debts";

type Phase = "confirm" | "approving" | "paying" | "done" | "error";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function RepayPage() {
  const params = useParams<{ address: string }>();
  const circleAddress = params.address as Address;
  const router = useRouter();
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { terms } = useCircleTerms(circleAddress);
  const { debts } = useCircleDebts(circleAddress);
  const tokenSymbol = tokens.find((t) => t.address.toLowerCase() === terms?.token.toLowerCase())?.symbol ?? "?";

  const myDebts = debts.filter((d) => account && d.debtor.toLowerCase() === account.toLowerCase());

  // Debts load asynchronously (event query + on-chain read), so there's no
  // single render where "the first debt" is knowable up front. Track only
  // an explicit choice + an explicit amount edit, and derive the rest from
  // whatever myDebts currently is — a useState initial value would freeze
  // on whatever was true (usually nothing) at the very first render.
  const [selectedCreditor, setSelectedCreditor] = useState<Address | null>(null);
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState("");
  const [paidAmount, setPaidAmount] = useState(0n);
  const [paidTo, setPaidTo] = useState<Address | null>(null);

  const selected = (selectedCreditor ? myDebts.find((d) => d.creditor === selectedCreditor) : undefined) ?? myDebts[0];
  const amountStr = amountOverride ?? (selected ? formatUnits(selected.amount, 18) : "");

  function selectDebt(creditor: Address) {
    setSelectedCreditor(creditor);
    setAmountOverride(null);
  }

  async function handleRepay() {
    if (!publicClient || !terms || !selected) return;
    setError("");
    try {
      const amount = parseUnits(amountStr || "0", 18);
      if (amount === 0n || amount > selected.amount) {
        setError("Enter an amount between 0 and what you owe.");
        setPhase("error");
        return;
      }

      const allowance = (await publicClient.readContract({
        address: terms.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [selected.debtor, circleAddress],
      })) as bigint;

      if (allowance < amount) {
        setPhase("approving");
        const approveHash = await writeContractAsync({
          address: terms.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [circleAddress, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setPhase("paying");
      const hash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "repay",
        args: [selected.creditor, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setPaidAmount(amount);
      setPaidTo(selected.creditor);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  if (!terms) {
    return <div className="pt-11 text-muted-foreground">Loading…</div>;
  }

  if (myDebts.length === 0 && phase !== "done") {
    return (
      <div className="max-w-[560px] pt-11">
        <h2 className="mb-3 text-[30px] font-normal">Nothing to pay back</h2>
        <p className="mb-5 text-[17px] text-[oklch(0.35_0.012_85)]">
          This wallet doesn&rsquo;t owe anyone on this circle right now.
        </p>
        <Link
          href={`/c/${circleAddress}`}
          className="inline-block border border-[oklch(0.75_0.012_85)] px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
        >
          Back to the circle
        </Link>
      </div>
    );
  }

  const amountBig = (() => {
    try {
      return parseUnits(amountStr || "0", 18);
    } catch {
      return 0n;
    }
  })();
  const willClearDebt = !!selected && amountBig >= selected.amount;

  return (
    <div className="max-w-[560px] pt-11">
      {(phase === "confirm" || phase === "approving" || phase === "paying") && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Past rounds
          </div>
          <h2 className="mt-3 mb-2 text-[30px] font-normal">Pay back what you owe</h2>
          <p className="mb-[22px] text-[17px] text-[oklch(0.35_0.012_85)]">
            These are debts to specific people from rounds you didn&rsquo;t
            pay. There&rsquo;s no deadline and no penalty — they just stay
            on the chain until you clear them.
          </p>

          <div className="border-t border-[oklch(0.86_0.012_85)]">
            {myDebts.map((d) => (
              <div key={`${d.debtor}-${d.creditor}`} className="border-b border-[oklch(0.91_0.012_85)]">
                <button
                  type="button"
                  onClick={() => selectDebt(d.creditor)}
                  disabled={phase !== "confirm"}
                  className={
                    "block w-full px-3.5 py-3.5 text-left border-l-2 " +
                    (selected?.creditor === d.creditor
                      ? "border-l-primary bg-[oklch(0.965_0.014_320)]"
                      : "border-l-transparent")
                  }
                >
                  <div className="text-[17px]">
                    To {truncate(d.creditor)} — {formatUnits(d.amount, 18)} {tokenSymbol}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                    Round {d.round}
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-[22px]">
            <div className="mb-2 font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.48_0.012_85)] uppercase">
              Amount to pay now
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[15px] text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                value={amountStr}
                onChange={(e) => setAmountOverride(e.target.value)}
                disabled={phase !== "confirm"}
                className="w-[120px] border-0 border-b border-[oklch(0.78_0.012_85)] bg-transparent px-0.5 py-1 font-mono text-[15px] tracking-[-0.03em] outline-none focus-visible:border-primary"
              />
              <span className="font-mono text-[11px] text-muted-foreground">{tokenSymbol}</span>
              <button
                type="button"
                disabled={phase !== "confirm"}
                onClick={() => setAmountOverride(null)}
                className="ml-2 cursor-pointer border-b border-dashed border-[oklch(0.75_0.012_85)] font-mono text-[9.5px] tracking-[0.06em] text-muted-foreground uppercase"
              >
                Pay in full
              </button>
            </div>
            <div className="mt-2.5 text-[15px] text-[oklch(0.45_0.012_85)]">
              {selected && willClearDebt
                ? `This clears the debt to ${truncate(selected.creditor)} completely.`
                : selected
                  ? `${truncate(selected.creditor)} will still be owed ${formatUnits(selected.amount - amountBig, 18)} ${tokenSymbol} after this.`
                  : ""}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              disabled={phase !== "confirm" || !selected}
              onClick={handleRepay}
              className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "approving" ? "Approving…" : phase === "paying" ? "Paying…" : "Confirm and pay back"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/c/${circleAddress}`)}
              disabled={phase !== "confirm"}
              className="cursor-pointer font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-destructive uppercase">
            Repayment didn&rsquo;t go through
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
              href={`/c/${circleAddress}`}
              className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:text-primary"
            >
              Back to the circle
            </Link>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">Paid back</div>
          <h2 className="mt-3 mb-3 text-[30px] font-normal">
            {formatUnits(paidAmount, 18)} {tokenSymbol} paid back to {paidTo ? truncate(paidTo) : "…"}.
          </h2>
          <Link
            href={`/c/${circleAddress}`}
            className="inline-block border border-[oklch(0.75_0.012_85)] px-[18px] py-3 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors hover:border-primary hover:text-primary"
          >
            Back to the circle
          </Link>
        </div>
      )}
    </div>
  );
}
