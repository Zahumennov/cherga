"use client";

import { useState } from "react";
import Link from "next/link";
import { InviteLinkButton } from "@/components/invite-link-button";

const steps = [
  {
    n: "01",
    label: "Set terms",
    title: "One person sets the terms.",
    body: "Which stablecoin, how much each person pays per round, how many people are in the circle (2–20), how long a round lasts, and the date by which the circle has to be full. After the circle exists, none of it can be changed — not by the person who made it, not by anyone.",
  },
  {
    n: "02",
    label: "Everyone joins",
    title: "Everyone joins through one link.",
    body: "The order people join in is the queue, and the queue is the payout order — first to join is paid first, last to join is paid last. If the circle isn't full by the deadline it is cancelled and nobody has paid anything.",
  },
  {
    n: "03",
    label: "Pay per round",
    title: "Each round, everyone pays once except the person being paid.",
    body: "Eight friends at $100 a month: seven people pay, and the eighth — whoever's turn it is — receives the $700. Everyone can see who has paid this round and who hasn't.",
  },
  {
    n: "04",
    label: "Recipient claims",
    title: "The recipient claims the pool.",
    body: "If someone didn't pay, the round still closes: the recipient takes whatever was collected, and the missing amount becomes that one person's debt to that one recipient. It stays on the chain, with no deadline and no penalty, until they pay it back.",
  },
  {
    n: "05",
    label: "Repeat until done",
    title: "The next round opens, and so on until the queue runs out.",
    body: "Eight people means eight rounds. At the end everyone has paid in the same amount and taken out the same amount, the circle closes for good, and the only thing that can still be outstanding is a debt between two specific people.",
  },
];

const reasons = [
  {
    title: "A lump sum, no lender",
    body: "Going early is a loan from your friends at zero interest — no credit check, no bank, no collateral. You pay it back in the following rounds, in instalments you already agreed to.",
  },
  {
    title: "Saving you actually keep up",
    body: "Going late is saving with a deadline and an audience. Most people skip a solo savings plan; far fewer skip a payment their friends are waiting on.",
  },
  {
    title: "No treasurer, no arguments",
    body: "Nobody holds the box and nobody keeps the notebook. Who paid, who was short, who owes whom — all of it is on the chain, identical for everyone, and impossible to misremember.",
  },
];

export default function Home() {
  const [openStep, setOpenStep] = useState<number | null>(0);

  return (
    <div>
      <div className="max-w-[600px] pt-12">
        <div className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Rotating savings, kept honestly
        </div>
        <h1 className="mt-[14px] text-[40px] leading-[1.12] font-normal tracking-[-0.01em] max-sm:text-[30px]">
          A cash box that no one has to hold.
        </h1>
      </div>

      <div className="mt-[26px] flex flex-wrap items-start gap-3">
        <div>
          <Link
            href="/create"
            className="block border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
          >
            Create a circle
          </Link>
          <div className="mt-[7px] max-w-[210px] font-mono text-[9px] leading-[1.5] tracking-[0.04em] text-muted-foreground">
            Unaudited, personal project — use at your own risk
          </div>
        </div>
        <InviteLinkButton />
      </div>

      <div className="mt-[30px] grid max-w-[620px] grid-cols-[20px_1fr] gap-x-3 border border-[oklch(0.83_0.055_92)] bg-[oklch(0.955_0.032_95)] px-[18px] py-4">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="mt-0.5 overflow-visible">
          <path d="M10 2.6 18.4 17H1.6z" fill="none" stroke="oklch(0.52 0.10 78)" strokeWidth="1.2" />
          <path d="M10 7.4v4.6" stroke="oklch(0.52 0.10 78)" strokeWidth="1.4" />
          <circle cx="10" cy="14.4" r="0.85" fill="oklch(0.52 0.10 78)" />
        </svg>
        <div>
          <div className="mb-[9px] font-mono text-[9.5px] tracking-[0.14em] text-[oklch(0.44_0.09_78)] uppercase">
            Read this first
          </div>
          <p className="text-[17px] leading-[1.6]">
            Cherga currently runs on the{" "}
            <strong className="font-medium">Whitechain testnet</strong> only.
            The stablecoins in a circle are test tokens with no value —
            nothing here moves real money. Cherga is{" "}
            <a
              href="https://x.com/zahumennov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[oklch(0.7_0.02_85)] underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
            >
              @zahumennov
            </a>
            &rsquo;s personal project, and comes with no support and no
            guarantees.
          </p>
        </div>
      </div>

      <div className="mt-10 max-w-[620px] border-t border-border pt-5">
        <p className="mb-4 text-[oklch(0.32_0.012_85)]">
          A fixed group of 2–20 people chip in the same amount on the same
          schedule, and each round the whole pool goes to one member — in
          turn, until everyone has received it exactly once. Whoever goes
          first borrowed at no interest. Whoever goes last lent at no
          interest. Nobody ends up ahead and nobody ends up behind.
        </p>
        <p className="text-[oklch(0.32_0.012_85)]">
          People have run this for centuries — <em>tanda</em> in Mexico,{" "}
          <em>susu</em> in West Africa, <em>hui</em> in China,{" "}
          <em>chit funds</em> in India, <em>pardna</em> in Jamaica. Cherga is
          the same arrangement written as a smart contract, so the
          bookkeeping can&rsquo;t be faked and no one has to be the
          treasurer.
        </p>
      </div>

      <div className="mt-[46px] grid grid-cols-1 gap-x-10 gap-y-[26px] border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">
            This might not be for you
          </div>
          <p className="text-base text-[oklch(0.36_0.012_85)]">
            If your group is in one place and one currency, a shared
            spreadsheet and a jar will do the job better. If you&rsquo;re
            looking for a return on money, this pays none — by design. If
            you don&rsquo;t already know every person in the circle
            personally, close this page.
          </p>
        </div>
        <div>
          <div className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">
            It might be for you
          </div>
          <p className="text-base text-[oklch(0.36_0.012_85)]">
            Friends spread across countries who can&rsquo;t pass a box
            around. Groups who already hold stablecoins. People whose local
            currency loses value while they wait their turn.
          </p>
        </div>
      </div>

      <div className="mt-[46px] border-t border-border pt-[18px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <div className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
            How it works
          </div>
          <div className="font-mono text-[9px] tracking-[0.08em] text-[oklch(0.6_0.012_85)] uppercase">
            Tap a step for detail
          </div>
        </div>
        <h2 className="mt-2.5 mb-5 max-w-[560px] text-[26px] font-normal">
          Five steps, then it&rsquo;s over. Nothing renews and nothing runs
          in the background.
        </h2>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(122px,1fr))] gap-px border border-border bg-border">
          {steps.map((s, i) => {
            const open = openStep === i;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setOpenStep(open ? null : i)}
                className={
                  "flex flex-col items-start gap-[5px] px-3 pt-[11px] pb-3 text-left transition-colors " +
                  (open ? "bg-primary text-primary-foreground" : "bg-background text-[oklch(0.3_0.012_85)]")
                }
              >
                <span className="font-mono text-[10px] tracking-[0.02em] opacity-65">{s.n}</span>
                <span className="text-[16px] leading-[1.3]">{s.label}</span>
              </button>
            );
          })}
        </div>

        {openStep !== null && (
          <div className="max-w-[620px] pt-4 pb-0.5">
            <div className="mb-[5px] text-[19px]">{steps[openStep].title}</div>
            <div className="text-base text-[oklch(0.42_0.012_85)]">
              {steps[openStep].body}
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 border-t border-border pt-[18px]">
        <div className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
          What it&rsquo;s for
        </div>
        <h2 className="mt-2.5 mb-2 max-w-[560px] text-[26px] font-normal">
          Nobody makes money here. That is the point.
        </h2>
        <p className="mb-6 max-w-[620px] text-[17px] text-[oklch(0.38_0.012_85)]">
          A circle moves money around in time instead of growing it. You give
          up access to small amounts for a while and get one large amount
          when your turn comes — and someone else in the group gets the same
          deal, in a different month.
        </p>
        <div className="grid grid-cols-1 gap-x-10 gap-y-[22px] sm:grid-cols-2">
          {reasons.map((r) => (
            <div key={r.title} className="border-t border-[oklch(0.9_0.012_85)] pt-3">
              <div className="mb-1.5 font-mono text-[10px] tracking-[0.08em] text-primary uppercase">
                {r.title}
              </div>
              <div className="text-base text-[oklch(0.38_0.012_85)]">
                {r.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-[54px] flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-4">
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground">
          CHERGA
        </span>
        <span className="max-w-[460px] font-mono text-[9.5px] leading-[1.6] tracking-[0.04em] text-muted-foreground">
          Whitechain testnet only — test tokens, not real money.
        </span>
      </div>
    </div>
  );
}
