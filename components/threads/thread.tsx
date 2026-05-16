"use client"

import { useEffect, useRef, useState } from "react"

import { CommentComposer } from "./comment-composer"
import { CommentRow } from "./comment-row"
import { ReactionBar } from "./reaction-bar"
import type { ThreadResponse } from "@/lib/api/contracts"
import { threadApiPaths, type ThreadTarget } from "@/lib/threads/api-paths"
import type {
  ThreadComment,
  ThreadReactionSummary,
} from "@/lib/threads/comments"

type ThreadProps = {
  target: ThreadTarget
  viewerId: string
  /**
   * Controlled comment-composer draft. Lifted up to the attachment so
   * it survives the thread itself unmounting when the user collapses it
   * (or, on mobile, when opening another thread auto-collapses this one).
   */
  commentDraft: string
  onCommentDraftChange: (next: string) => void
  /** Seed comments shown immediately (often `[]`). */
  initialComments?: ThreadComment[]
  /** Seed reactions shown immediately (often `[]`). */
  initialReactions?: ThreadReactionSummary[]
  /**
   * Bubbles whenever the local thread state changes — lets the
   * surrounding row update its collapsed-state chip in place
   * (unread dot clears, count bumps, reactions refresh).
   */
  onSummaryChange?: (next: {
    commentCount: number
    reactions: ThreadReactionSummary[]
    hasUnread: false // expanding always clears unread
  }) => void
}

export function Thread({
  target,
  viewerId,
  commentDraft,
  onCommentDraftChange,
  initialComments = [],
  initialReactions = [],
  onSummaryChange,
}: Readonly<ThreadProps>) {
  const [comments, setComments] = useState<ThreadComment[]>(initialComments)
  const [reactions, setReactions] =
    useState<ThreadReactionSummary[]>(initialReactions)
  const [isLoading, setIsLoading] = useState(true)
  // Avoid re-firing onSummaryChange on identical state — keeps parent
  // renders cheap and prevents update loops if the parent threads back
  // through props.
  const lastSummaryRef = useRef<string>("")

  const paths = threadApiPaths(target)

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(paths.comments, {
          signal: controller.signal,
        })
        const data = (await res.json()) as ThreadResponse
        if (!data.ok) {
          setIsLoading(false)
          return
        }
        setComments(data.data.comments)
        setReactions(data.data.reactions)
        setIsLoading(false)
      } catch {
        // Aborted on unmount — fine.
      }
    })()

    // Fire-and-forget: mark thread viewed. Failure is silent — worst
    // case the unread dot lingers until the next visit.
    void fetch(paths.view, { method: "POST" }).catch(() => {})

    return () => controller.abort()
    // `paths.comments` / `paths.view` are derived from `target`, but
    // we depend on the stable target identity (type+id) instead so the
    // effect doesn't refire on prop-object identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.type, target.id])

  // Notify the parent on every local change so the collapsed chip
  // stays in sync (count, reactions) and the unread dot clears.
  useEffect(() => {
    if (!onSummaryChange) return
    const commentCount = comments.filter((c) => !c.deleted).length
    const signature = `${commentCount}|${reactions
      .map((r) => `${r.kind}:${r.count}:${r.viewerReacted ? 1 : 0}`)
      .sort()
      .join(",")}`
    if (signature === lastSummaryRef.current) return
    lastSummaryRef.current = signature
    onSummaryChange({ commentCount, reactions, hasUnread: false })
  }, [comments, reactions, onSummaryChange])

  return (
    <div className="space-y-3 rounded-md border border-border bg-card/40 p-3">
      <ReactionBar
        target={target}
        reactions={reactions}
        onReactionsChange={setReactions}
      />

      {comments.length > 0 ? (
        <div className="divide-y divide-border/60">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              target={target}
              comment={c}
              viewerId={viewerId}
              onUpdate={setComments}
              onCommentChanged={() => {
                /* count syncs through useEffect above */
              }}
            />
          ))}
        </div>
      ) : isLoading ? (
        <p className="py-1 text-xs text-muted-foreground">Loading replies…</p>
      ) : (
        <p className="py-1 text-xs text-muted-foreground">
          No replies yet. Be the first to chime in.
        </p>
      )}

      <CommentComposer
        target={target}
        draft={commentDraft}
        onDraftChange={onCommentDraftChange}
        onThreadChange={(next) => {
          setComments(next.comments)
          setReactions(next.reactions)
        }}
      />
    </div>
  )
}
