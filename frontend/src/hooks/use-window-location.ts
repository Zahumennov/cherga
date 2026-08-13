"use client";

import { useSyncExternalStore } from "react";

// window.location doesn't change without a navigation, so no real
// subscription is needed — but reading it still has to go through
// useSyncExternalStore (not a useEffect+setState) to give React a
// consistent value between the server render (empty string) and the
// first client render, without a hydration mismatch.
function subscribe() {
  return () => {};
}

export function useWindowLocationHash() {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => "");
}

export function useWindowOrigin() {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}
