"use client"

import { useCallback, useState } from "react"

import { NoteThread } from "./note-thread"
import { ThreadSummaryChip } from "./thread-summary-chip"
import { useThreadExpansion } from "./thread-expansion-context"
import type { ThreadReactionSummary } from "@/lib/notes/comments"

type NoteThreadAttachmentProps = {
  noteId: string
  viewerId: string
  initialCommentCount: number
  initialReactions: ThreadReactionSummary[]
  initialHasUnread: boolean
  /**
   * When true, an empty-state chip ("Start a discussion") renders so the
   * user can open the thread even with no activity. Pass `true` for the
   * note's author and assignees; `false` for other viewers (e.g. a
   * non-targeted staff member browsing the workspace).
   */
  showStartHint?: boolean
}

/**
 * Single entry point for surfacing a note's thread on a card or row.
 * Coordinates with `ThreadExpansionProvider` (when mounted above) so
 * mobile shows at most one open thread per surface; falls back to local
 * `useState` when no provider is present.
 *
 * Persists the comment composer draft locally so the user doesn't lose
 * in-progress text when the thread auto-collapses due to another being
 * opened (mobile rule). Drafts are scoped to this component instance —
 * a full page navigation drops them.
 */
export function NoteThreadAttachment({
  noteId,
  viewerId,
  initialCommentCount,
  initialReactions,
  initialHasUnread,
  showStartHint = false,
}: Readonly<NoteThreadAttachmentProps>) {
  const expansion = useThreadExpansion()
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = expansion
    ? expansion.isExpanded(noteId)
    : localExpanded
  const toggleExpanded = useCallback(() => {
    if (expansion) {
      expansion.setExpanded(noteId, !expansion.isExpanded(noteId))
    } else {
      setLocalExpanded((v) => !v)
    }
  }, [expansion, noteId])

  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [reactions, setReactions] =
    useState<ThreadReactionSummary[]>(initialReactions)
  // Once the user has expanded once, the unread dot stays cleared even
  // if they collapse again.
  const [hasUnread, setHasUnread] = useState(initialHasUnread)

  // Comment-composer draft lives here so it survives the thread itself
  // unmounting on collapse (which it does — `NoteThread` is conditionally
  // rendered). Per-noteId scope is implicit since this component is
  // mounted once per note row.
  const [commentDraft, setCommentDraft] = useState("")

  const onSummaryChange = useCallback(
    (next: {
      commentCount: number
      reactions: ThreadReactionSummary[]
      hasUnread: false
    }) => {
      setCommentCount(next.commentCount)
      setReactions(next.reactions)
      setHasUnread(false)
    },
    [],
  )

  return (
    <div className="space-y-2">
      <ThreadSummaryChip
        commentCount={commentCount}
        reactions={reactions}
        hasUnread={hasUnread}
        expanded={expanded}
        showStartHint={showStartHint}
        onToggle={toggleExpanded}
      />
      {expanded ? (
        <NoteThread
          noteId={noteId}
          viewerId={viewerId}
          commentDraft={commentDraft}
          onCommentDraftChange={setCommentDraft}
          onSummaryChange={onSummaryChange}
        />
      ) : null}
    </div>
  )
}
