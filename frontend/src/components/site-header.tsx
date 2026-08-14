"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount } from "wagmi";
import { useMyCircles, type MyCircle } from "@/hooks/use-my-circles";

function needsYouCount(circles: MyCircle[] | undefined) {
  if (!circles) return 0;
  return circles.filter(
    (c) =>
      (c.state === "Active" && c.isRecipientThisRound && c.claimable > 0n) ||
      (c.state === "Active" && !c.isRecipientThisRound && !c.hasPaidThisRound) ||
      c.oweAmount > 0n,
  ).length;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { address: account, isConnected } = useAccount();
  const { data: circles } = useMyCircles(account);
  const badge = needsYouCount(circles);
  const onCircles = pathname === "/circles";

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pt-[22px] pb-[14px]">
      <Link href="/" className="flex items-baseline gap-2.5">
        <span className="font-mono text-[13px] font-medium tracking-[0.14em]">
          CHERGA
        </span>
        <span className="font-mono text-[9.5px] tracking-[0.1em] text-muted-foreground">
          ЧЕРГА · A QUEUE
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {isConnected && (
          <Link
            href="/circles"
            className={
              "flex items-center gap-1.5 border-b font-mono text-[10px] tracking-[0.06em] uppercase transition-colors " +
              (onCircles ? "border-primary text-primary" : "border-transparent text-[oklch(0.4_0.012_85)] hover:text-primary")
            }
          >
            My circles
            {badge > 0 && (
              <span className="bg-primary px-[5px] py-px font-mono text-[9px] text-primary-foreground">
                {badge}
              </span>
            )}
          </Link>
        )}
        <ConnectKitButton.Custom>
          {({ show, truncatedAddress }) => (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10.5px] tracking-[0.02em] text-muted-foreground">
                {isConnected ? truncatedAddress : "no wallet"}
              </span>
              <button
                type="button"
                onClick={show}
                className="cursor-pointer border border-border px-[9px] py-[5px] font-mono text-[10px] tracking-[0.06em] text-foreground/70 uppercase transition-colors hover:border-primary hover:text-primary"
              >
                {isConnected ? "Account" : "Connect"}
              </button>
            </div>
          )}
        </ConnectKitButton.Custom>
      </div>
    </div>
  );
}
