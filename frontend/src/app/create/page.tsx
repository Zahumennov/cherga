"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { decodeEventLog, parseUnits, type Address } from "viem";
import { circleFactoryAddress, tokens, CircleFactoryAbi } from "@/lib/contracts";
import { generateSecret, inviteHashFor } from "@/lib/secret";

const ROUND_LENGTHS = [
  { id: "weekly", label: "Weekly", word: "weekly", seconds: 7 * 86400 },
  { id: "biweekly", label: "Every 2 weeks", word: "every two weeks", seconds: 14 * 86400 },
  { id: "monthly", label: "Monthly", word: "monthly", seconds: 30 * 86400 },
] as const;

type Phase = "form" | "creating" | "joining" | "error";

function chipClass(active: boolean) {
  return [
    "cursor-pointer border px-[11px] py-2 font-mono text-[10px] tracking-[0.06em] uppercase transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-[oklch(0.8_0.012_85)] bg-transparent text-[oklch(0.38_0.012_85)] hover:border-primary hover:text-primary",
  ].join(" ");
}

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const token = tokens[0];
  const [amount, setAmount] = useState("100");
  const [size, setSize] = useState(8);
  const [lengthId, setLengthId] = useState<(typeof ROUND_LENGTHS)[number]["id"]>("monthly");
  const [deadlineDays, setDeadlineDays] = useState("7");

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");

  const length = ROUND_LENGTHS.find((l) => l.id === lengthId)!;
  const amountNum = Number(amount) || 0;
  const pot = size * amountNum;
  const canSubmit = isConnected && amountNum > 0 && Number(deadlineDays) >= 1 && phase === "form";

  const summary = useMemo(
    () =>
      `${size} people, $${amountNum} ${token.symbol} each, ${length.word} — the first person gets $${pot} straight away, the last person finishes having saved $${pot} with no interest either way. It runs for ${size} rounds and then it is over.`,
    [size, amountNum, token.symbol, length.word, pot],
  );

  async function handleCreate() {
    if (!publicClient) return;
    setError("");
    setPhase("creating");
    try {
      const secret = generateSecret();
      const inviteHash = inviteHashFor(secret);
      const contribution = parseUnits(amount, 18);
      const fillDeadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);

      const createHash = await writeContractAsync({
        address: circleFactoryAddress,
        abi: CircleFactoryAbi,
        functionName: "create",
        args: [token.address, contribution, size, length.seconds, fillDeadline, inviteHash],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

      let circleAddress: Address | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: CircleFactoryAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "CircleDeployed") {
            circleAddress = decoded.args.circle;
            break;
          }
        } catch {
          continue;
        }
      }
      if (!circleAddress) throw new Error("Could not find the new circle's address in the transaction.");

      setPhase("joining");
      const { CircleAbi } = await import("@/lib/contracts");
      const joinHash = await writeContractAsync({
        address: circleAddress,
        abi: CircleAbi,
        functionName: "join",
        args: [secret],
      });
      await publicClient.waitForTransactionReceipt({ hash: joinHash });

      router.push(`/c/${circleAddress}/invite#s=${secret}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  return (
    <div className="pt-[34px]">
      <h2 className="mt-4 mb-1 text-[30px] font-normal">Create a circle</h2>
      <p className="mb-[30px] text-base text-muted-foreground">
        Set the terms once. They can&rsquo;t be changed after the circle is
        created.
      </p>

      <div className="border-t border-[oklch(0.86_0.012_85)]">
        <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-[oklch(0.9_0.012_85)] py-4 sm:grid-cols-[190px_1fr]">
          <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.45_0.012_85)] uppercase">
            Token
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((t) => (
              <span key={t.symbol} className={chipClass(true)}>
                {t.symbol}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-[oklch(0.9_0.012_85)] py-4 sm:grid-cols-[190px_1fr]">
          <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.45_0.012_85)] uppercase">
            Contribution per round
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] text-muted-foreground">$</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-[120px] border-0 border-b border-[oklch(0.78_0.012_85)] bg-transparent px-0.5 py-1 font-mono text-[15px] tracking-[-0.03em] outline-none focus-visible:border-primary"
            />
            <span className="font-mono text-[11px] text-muted-foreground">
              {token.symbol}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-[oklch(0.9_0.012_85)] py-4 sm:grid-cols-[190px_1fr]">
          <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.45_0.012_85)] uppercase">
            Members
          </div>
          <div>
            <div className="flex items-center gap-3.5">
              <input
                type="range"
                min={2}
                max={20}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-[220px] accent-primary"
              />
              <span className="font-mono text-[15px] tracking-[-0.03em]">{size}</span>
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
              2–20 · one round each
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-[oklch(0.9_0.012_85)] py-4 sm:grid-cols-[190px_1fr]">
          <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.45_0.012_85)] uppercase">
            Round length
          </div>
          <div className="flex flex-wrap gap-2">
            {ROUND_LENGTHS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLengthId(l.id)}
                className={chipClass(lengthId === l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-baseline gap-x-6 border-b border-[oklch(0.86_0.012_85)] py-4 sm:grid-cols-[190px_1fr]">
          <div className="font-mono text-[10.5px] tracking-[0.06em] text-[oklch(0.45_0.012_85)] uppercase">
            Deadline to fill
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                min={1}
                max={60}
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(e.target.value)}
                className="w-20 border-0 border-b border-[oklch(0.78_0.012_85)] bg-transparent px-0.5 py-1 font-mono text-[15px] tracking-[-0.03em] outline-none focus-visible:border-primary"
              />
              <span className="font-mono text-[11px] text-muted-foreground">DAYS</span>
            </div>
            <div className="mt-1.5 text-[15px] text-[oklch(0.45_0.012_85)]">
              If the circle isn&rsquo;t full by then it is cancelled and
              nobody has paid anything.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-[26px] border border-[oklch(0.88_0.012_85)] bg-[oklch(0.955_0.014_85)] px-[22px] py-5">
        <div className="mb-2.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
          In plain words
        </div>
        <p className="text-[19px] leading-[1.5]">{summary}</p>
      </div>

      <div className="mt-6 border-t border-b border-[oklch(0.86_0.012_85)] py-4">
        <div className="mb-2 font-mono text-[9.5px] tracking-[0.14em] text-primary uppercase">
          Before you create it
        </div>
        <p className="text-base text-[oklch(0.32_0.012_85)]">
          This isn&rsquo;t insured or reversible. Only share this circle with
          people you&rsquo;d trust with cash in person.
        </p>
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleCreate}
          className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "creating"
            ? "Creating…"
            : phase === "joining"
              ? "Joining…"
              : "Create circle"}
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {isConnected
            ? "Two wallet transactions: create the circle, then join it as member 1"
            : "Connect a wallet first"}
        </span>
      </div>

      {phase === "error" && (
        <div className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
