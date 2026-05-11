"use client";

import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = (): boolean | null => null;

export function useMediaQuery(query: string): boolean | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (globalThis.window === undefined) return () => {};
      const mql = globalThis.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = useCallback((): boolean | null => {
    if (globalThis.window === undefined) return null;
    return globalThis.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
