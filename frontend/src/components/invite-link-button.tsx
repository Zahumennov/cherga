"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const JOIN_PATH = /^\/c\/0x[a-fA-F0-9]{40}\/join$/;

export function InviteLinkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleGo() {
    let pathname: string;
    let hash: string;
    try {
      const url = new URL(value, window.location.origin);
      pathname = url.pathname;
      hash = url.hash;
    } catch {
      setError("That doesn't look like a link.");
      return;
    }
    if (!JOIN_PATH.test(pathname)) {
      setError("That doesn't look like a Cherga invite link.");
      return;
    }
    router.push(pathname + hash);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-[oklch(0.75_0.012_85)] bg-transparent px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-[oklch(0.3_0.012_85)] uppercase transition-colors hover:border-primary hover:text-primary"
      >
        I have an invite link
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 sm:min-w-[360px] sm:flex-none">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          placeholder="Paste your invite link"
          className="min-w-0 flex-1 border border-[oklch(0.78_0.012_85)] bg-transparent px-2 py-[13px] font-mono text-[13px] tracking-[-0.02em] outline-none focus-visible:border-primary"
        />
        <button
          type="button"
          onClick={handleGo}
          className="cursor-pointer border border-primary bg-primary px-5 py-[13px] font-mono text-[11px] tracking-[0.08em] text-primary-foreground uppercase transition-colors hover:bg-[oklch(0.36_0.11_320)]"
        >
          Go
        </button>
      </div>
      {error && (
        <div className="font-mono text-[10.5px] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
