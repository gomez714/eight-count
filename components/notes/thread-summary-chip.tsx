"use client"

import { MessageCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  REACTION_EMOJI,
  REACTION_KINDS,
  type ReactionKind,
} from "@/lib/notes/reactions"

type ReactionCount = { kind: ReactionKind; count: number }

type ThreadSummaryChipProps = {
  commentCount: number
  reactions: ReactionCount[]
  hasUnread: boolean
  expanded: boolean
  onToggle: () => void
  /**
   * When true and the thread has no activity, renders a "Start a
   * discussion" affordance instead of nothing. Use this for note
   * authors + assignees only.
   */
  showStartHint?: boolean
}

export function ThreadSummaryChip({
  commentCount,
  reactions,
  hasUnread,
  expanded,
  onToggle,
  showStartHint = false,
}: Readonly<ThreadSummaryChipProps>) {
  const isEmpty = commentCount === 0 && reactions.every((r) => r.count === 0)

  if (isEmpty && !showStartHint) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        expanded && "bg-muted text-foreground"
      )}
    >
      <span className="relative inline-flex items-center gap-1.5">
        <MessageCircle aria-hidden className="size-3.5" />
        {isEmpty ? (
          <span>Start a discussion</span>
        ) : (
          <span>
            {commentCount} {commentCount === 1 ? "reply" : "replies"}
          </span>
        )}
        {hasUnread ? (
          <span
            aria-label="New replies"
            className="absolute -top-0.5 -right-2 inline-block size-1.5 rounded-full"
            style={{ backgroundColor: "var(--primary)" }}
          />
        ) : null}
      </span>
      {!isEmpty && reactions.length > 0 ? (
        <span aria-hidden className="text-muted-foreground/60">
          ·
        </span>
      ) : null}
      {!isEmpty ? (
        <span className="inline-flex items-center gap-1.5">
          {REACTION_KINDS.map((kind) => {
            const summary = reactions.find((r) => r.kind === kind)
            if (!summary || summary.count === 0) return null
            return (
              <span
                key={kind}
                className="inline-flex items-center gap-0.5 tabular-nums"
                aria-label={`${summary.count} ${kind.toLowerCase()} reactions`}
              >
                <span aria-hidden>{REACTION_EMOJI[kind]}</span>
                {summary.count}
              </span>
            )
          })}
        </span>
      ) : null}
    </button>
  )
}
