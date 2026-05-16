"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { useMediaQuery } from "@/lib/hooks/use-media-query"
import type { ThreadTarget } from "@/lib/threads/api-paths"

/**
 * Coordinates which threads are expanded inside a single list surface
 * (the rehearsal workspace, /my-notes, /notes-by-me, the project page's
 * discussion section). On desktop (≥ lg), multiple threads may be open
 * simultaneously — comparing replies across notes/discussions is a
 * power-user move. On mobile, the set collapses to at most one open
 * thread at a time: opening any thread closes whichever one was
 * previously open. Per-thread comment drafts persist in
 * `ThreadAttachment`'s local state, so the auto-collapse doesn't cost
 * the user any in-progress text.
 *
 * Keys are `${target.type}:${target.id}` so a note ID and a discussion
 * ID never collide even though both are cuids — and so the mobile
 * single-open rule applies across the union (opening a discussion
 * thread auto-collapses an open note thread on the same surface).
 *
 * The provider is mounted at the list level (one per surface), so each
 * page coordinates its own threads independently.
 */
type ThreadExpansionValue = {
  isExpanded: (target: ThreadTarget) => boolean
  setExpanded: (target: ThreadTarget, next: boolean) => void
}

const ThreadExpansionContext = createContext<ThreadExpansionValue | null>(null)

type ThreadExpansionProviderProps = {
  children: ReactNode
}

function targetKey(target: ThreadTarget): string {
  return `${target.type}:${target.id}`
}

export function ThreadExpansionProvider({
  children,
}: Readonly<ThreadExpansionProviderProps>) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const isExpanded = useCallback(
    (target: ThreadTarget) => expandedKeys.has(targetKey(target)),
    [expandedKeys],
  )

  const setExpanded = useCallback(
    (target: ThreadTarget, next: boolean) => {
      const key = targetKey(target)
      setExpandedKeys((prev) => {
        const out = new Set(prev)
        if (next) {
          // On mobile (or during SSR / pre-hydration when isDesktop is
          // null, default to mobile to avoid a flash of multi-expansion),
          // clear before adding so only one thread is open. On desktop,
          // simply add to the existing set.
          if (isDesktop !== true) out.clear()
          out.add(key)
        } else {
          out.delete(key)
        }
        return out
      })
    },
    [isDesktop],
  )

  const value = useMemo(
    () => ({ isExpanded, setExpanded }),
    [isExpanded, setExpanded],
  )

  return (
    <ThreadExpansionContext.Provider value={value}>
      {children}
    </ThreadExpansionContext.Provider>
  )
}

/**
 * Read the coordinated thread-expansion state. Returns `null` when no
 * provider is mounted above (e.g. surfaces that haven't opted into the
 * coordinator yet) — callers in that case should fall back to local
 * `useState` so the attachment still works standalone.
 */
export function useThreadExpansion(): ThreadExpansionValue | null {
  return useContext(ThreadExpansionContext)
}
