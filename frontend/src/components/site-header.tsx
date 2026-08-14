"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";

export function SiteHeader() {
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
      <ConnectKitButton.Custom>
        {({ isConnected, show, truncatedAddress }) => (
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
  );
}
