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

/**
 * Coordinates which note threads are expanded inside a single list
 * surface (the rehearsal workspace, /my-notes, /notes-by-me). On
 * desktop (≥ lg), multiple threads may be open simultaneously —
 * comparing replies across notes is a power-user move. On mobile, the
 * set collapses to at most one open thread at a time: opening any
 * thread closes whichever one was previously open. Per-thread comment
 * drafts persist in `NoteThreadAttachment`'s local state, so the
 * auto-collapse doesn't cost the user any in-progress text.
 *
 * The provider is mounted at the list level (one per surface), so each
 * page coordinates its own threads independently.
 */
type ThreadExpansionValue = {
  isExpanded: (noteId: string) => boolean
  setExpanded: (noteId: string, next: boolean) => void
}

const ThreadExpansionContext = createContext<ThreadExpansionValue | null>(null)

type ThreadExpansionProviderProps = {
  children: ReactNode
}

export function ThreadExpansionProvider({
  children,
}: Readonly<ThreadExpansionProviderProps>) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const isExpanded = useCallback(
    (noteId: string) => expandedIds.has(noteId),
    [expandedIds],
  )

  const setExpanded = useCallback(
    (noteId: string, next: boolean) => {
      setExpandedIds((prev) => {
        const out = new Set(prev)
        if (next) {
          // On mobile (or during SSR / pre-hydration when isDesktop is
          // null, default to mobile to avoid a flash of multi-expansion),
          // clear before adding so only one thread is open. On desktop,
          // simply add to the existing set.
          if (isDesktop !== true) out.clear()
          out.add(noteId)
        } else {
          out.delete(noteId)
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
