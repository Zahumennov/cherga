"use client";

import { useSyncExternalStore } from "react";

/// Unix seconds, ticking. A clock is the textbook use case for
/// useSyncExternalStore — calling Date.now() during render is impure,
/// and a plain useState+useEffect still trips the "no direct setState in
/// an effect body" rule (only subscription-callback setState is exempt).
function subscribe(callback: () => void) {
  const id = setInterval(callback, 5000);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot() {
  return 0;
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
