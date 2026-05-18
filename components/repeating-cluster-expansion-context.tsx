"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useMediaQuery } from "@/lib/hooks/use-media-query";

/**
 * Coordinates which repeating-cluster panels are expanded inside a single
 * list surface (the `/my-notes` drill view, the project drill board, the
 * project page's clusters card). On desktop (≥ lg) multiple panels may
 * open simultaneously — comparing two dancers' repeating clusters
 * side-by-side is a real staff-planning move. On mobile the set collapses
 * to at most one open panel: opening any cluster closes whichever one
 * was previously open.
 *
 * Keys are arbitrary strings chosen by the caller (`${tag}` for `/my-notes`
 * since the viewer is implicit; `${userId}-${tag}` for project surfaces
 * where each chip represents one dancer × tag). The provider doesn't
 * care about the format — it just tracks a `Set<string>`.
 *
 * The provider is mounted at the list level (one per surface), so each
 * page coordinates its own clusters independently. Mirrors
 * `ThreadExpansionProvider` deliberately so both expansion systems feel
 * the same to users navigating between surfaces.
 */
type RepeatingClusterExpansionValue = {
  isExpanded: (key: string) => boolean;
  setExpanded: (key: string, next: boolean) => void;
};

const RepeatingClusterExpansionContext =
  createContext<RepeatingClusterExpansionValue | null>(null);

type ProviderProps = {
  children: ReactNode;
};

export function RepeatingClusterExpansionProvider({
  children,
}: Readonly<ProviderProps>) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const isExpanded = useCallback(
    (key: string) => expandedKeys.has(key),
    [expandedKeys],
  );

  const setExpanded = useCallback(
    (key: string, next: boolean) => {
      setExpandedKeys((prev) => {
        const out = new Set(prev);
        if (next) {
          // SSR / pre-hydration returns null from useMediaQuery — treat as
          // mobile so we don't flash multi-expansion. On real mobile clear
          // before adding; on desktop accumulate.
          if (isDesktop !== true) out.clear();
          out.add(key);
        } else {
          out.delete(key);
        }
        return out;
      });
    },
    [isDesktop],
  );

  const value = useMemo(
    () => ({ isExpanded, setExpanded }),
    [isExpanded, setExpanded],
  );

  return (
    <RepeatingClusterExpansionContext.Provider value={value}>
      {children}
    </RepeatingClusterExpansionContext.Provider>
  );
}

/**
 * Read the coordinated expansion state. Returns `null` when no provider
 * is mounted above — callers should fall back to local `useState` so the
 * chip still works standalone.
 */
export function useRepeatingClusterExpansion(): RepeatingClusterExpansionValue | null {
  return useContext(RepeatingClusterExpansionContext);
}
