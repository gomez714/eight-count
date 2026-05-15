"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  REACTION_DESCRIPTIONS,
  REACTION_EMOJI,
  REACTION_KINDS,
  REACTION_LABELS,
  type ReactionKind,
} from "@/lib/notes/reactions"
import type { ToggleReactionResponse } from "@/lib/api/contracts"
import type { ThreadReactionSummary } from "@/lib/notes/comments"

type ReactionBarProps = {
  noteId: string
  reactions: ThreadReactionSummary[]
  onReactionsChange: (next: ThreadReactionSummary[]) => void
}

export function ReactionBar({
  noteId,
  reactions,
  onReactionsChange,
}: Readonly<ReactionBarProps>) {
  const [isPending, startTransition] = useTransition()

  const toggle = (kind: ReactionKind) => {
    if (isPending) return
    // Optimistic update.
    const next = optimisticToggle(reactions, kind)
    onReactionsChange(next)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/notes/${noteId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        })
        const data = (await res.json()) as ToggleReactionResponse
        if (!data.ok) {
          onReactionsChange(reactions)
          toast.error(data.error.message)
          return
        }
        onReactionsChange(data.data.reactions)
      } catch {
        onReactionsChange(reactions)
        toast.error("Couldn't update reaction. Try again.")
      }
    })
  }

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Reactions"
    >
      {REACTION_KINDS.map((kind) => {
        const summary = reactions.find((r) => r.kind === kind)
        const count = summary?.count ?? 0
        const reacted = summary?.viewerReacted ?? false
        return (
          <button
            type="button"
            key={kind}
            disabled={isPending}
            onClick={() => toggle(kind)}
            aria-pressed={reacted}
            aria-label={`${REACTION_LABELS[kind]}: ${REACTION_DESCRIPTIONS[kind]}`}
            title={REACTION_DESCRIPTIONS[kind]}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
              "border-border bg-card text-muted-foreground hover:bg-muted",
              reacted &&
                "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-foreground",
              isPending && "cursor-not-allowed opacity-70"
            )}
          >
            <span aria-hidden>{REACTION_EMOJI[kind]}</span>
            <span className="tabular-nums">{count > 0 ? count : ""}</span>
          </button>
        )
      })}
    </div>
  )
}

function optimisticToggle(
  reactions: ThreadReactionSummary[],
  kind: ReactionKind
): ThreadReactionSummary[] {
  const existing = reactions.find((r) => r.kind === kind)
  if (!existing) {
    return [...reactions, { kind, count: 1, viewerReacted: true }]
  }
  const nextCount = existing.viewerReacted
    ? existing.count - 1
    : existing.count + 1
  return reactions
    .map((r) =>
      r.kind === kind
        ? {
            ...r,
            count: Math.max(0, nextCount),
            viewerReacted: !r.viewerReacted,
          }
        : r
    )
    .filter((r) => r.count > 0 || r.viewerReacted)
}
