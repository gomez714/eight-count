"use client"

import { Send } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { CreateCommentResponse } from "@/lib/api/contracts"
import { threadApiPaths, type ThreadTarget } from "@/lib/threads/api-paths"
import {
  COMMENT_MAX_LENGTH,
  type ThreadComment,
  type ThreadReactionSummary,
} from "@/lib/threads/comments"
import { cn } from "@/lib/utils"

type CommentComposerProps = {
  target: ThreadTarget
  /**
   * Controlled draft value, lifted to `ThreadAttachment` so the draft
   * survives auto-collapse of the thread (mobile single-thread rule).
   * The composer reads from / writes back to this value.
   */
  draft: string
  onDraftChange: (next: string) => void
  onThreadChange: (next: {
    comments: ThreadComment[]
    reactions: ThreadReactionSummary[]
    commentCount: number
  }) => void
}

const SOFT_LIMIT = 1800

export function CommentComposer({
  target,
  draft,
  onDraftChange,
  onThreadChange,
}: Readonly<CommentComposerProps>) {
  const [isPending, startTransition] = useTransition()

  const trimmed = draft.trim()
  const overSoftLimit = draft.length >= SOFT_LIMIT
  const canSend = trimmed.length > 0 && trimmed.length <= COMMENT_MAX_LENGTH

  const submit = () => {
    if (!canSend || isPending) return
    startTransition(async () => {
      try {
        const res = await fetch(threadApiPaths(target).comments, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyText: trimmed }),
        })
        const data = (await res.json()) as CreateCommentResponse
        if (!data.ok) {
          toast.error(data.error.message)
          return
        }
        onThreadChange({
          comments: data.data.comments,
          reactions: data.data.reactions,
          commentCount: data.data.commentCount,
        })
        onDraftChange("")
      } catch {
        toast.error("Couldn't post comment. Try again.")
      }
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a reply…"
          maxLength={COMMENT_MAX_LENGTH}
          disabled={isPending}
          className="min-h-[40px] text-sm"
        />
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={!canSend || isPending}
          aria-label="Send reply"
          className="shrink-0"
        >
          <Send aria-hidden className="size-3.5" />
          Reply
        </Button>
      </div>
      {overSoftLimit ? (
        <p
          className={cn(
            "text-[11px]",
            draft.length > COMMENT_MAX_LENGTH
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {draft.length} / {COMMENT_MAX_LENGTH}
        </p>
      ) : null}
    </div>
  )
}
