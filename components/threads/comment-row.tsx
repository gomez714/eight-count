"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AvatarInitials } from "@/components/avatar-initials"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import type {
  DeleteCommentResponse,
  UpdateCommentResponse,
} from "@/lib/api/contracts"
import { threadApiPaths, type ThreadTarget } from "@/lib/threads/api-paths"
import { COMMENT_MAX_LENGTH, type ThreadComment } from "@/lib/threads/comments"
import { ROLE_LABEL, type TeamRole } from "@/app/teams/[teamId]/role-chip"
import { cn } from "@/lib/utils"

type CommentRowProps = {
  target: ThreadTarget
  comment: ThreadComment
  viewerId: string
  onCommentChanged: (next: { commentCount: number }) => void
  onUpdate: (next: ThreadComment[]) => void
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.max(0, Math.floor(diffMs / 1000))
  if (diffSec < 60) return "just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date)
}

export function CommentRow({
  target,
  comment,
  viewerId,
  onCommentChanged,
  onUpdate,
}: Readonly<CommentRowProps>) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(comment.bodyText ?? "")
  const [isPending, startTransition] = useTransition()
  const commentUrl = threadApiPaths(target).commentById(comment.id)

  const isOwn = comment.authorId === viewerId
  const displayName = comment.authorName ?? comment.authorEmail

  if (comment.deleted) {
    return (
      <div className="flex items-start gap-2.5 py-2">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Trash2 aria-hidden className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{displayName}</span>
            <span aria-hidden>·</span>
            <span>{formatRelative(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-muted-foreground italic">
            Comment deleted
          </p>
        </div>
      </div>
    )
  }

  const onSaveEdit = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      toast.error("Comment cannot be empty.")
      return
    }
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      toast.error(`Keep it under ${COMMENT_MAX_LENGTH} characters.`)
      return
    }
    if (trimmed === comment.bodyText) {
      setIsEditing(false)
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch(commentUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bodyText: trimmed }),
        })
        const data = (await res.json()) as UpdateCommentResponse
        if (!data.ok) {
          toast.error(data.error.message)
          return
        }
        onUpdate(data.data.comments)
        onCommentChanged({ commentCount: data.data.commentCount })
        setIsEditing(false)
      } catch {
        toast.error("Couldn't save edit. Try again.")
      }
    })
  }

  const onDelete = () => {
    if (!window.confirm("Delete this comment?")) return
    startTransition(async () => {
      try {
        const res = await fetch(commentUrl, {
          method: "DELETE",
        })
        const data = (await res.json()) as DeleteCommentResponse
        if (!data.ok) {
          toast.error(data.error.message)
          return
        }
        onUpdate(data.data.comments)
        onCommentChanged({ commentCount: data.data.commentCount })
      } catch {
        toast.error("Couldn't delete comment. Try again.")
      }
    })
  }

  return (
    <div className="flex items-start gap-2.5 py-2">
      <AvatarInitials
        name={comment.authorName}
        fallback={comment.authorEmail}
        toneSeed={comment.authorId}
        size={28}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs">
          <span className="font-medium text-foreground">{displayName}</span>
          {comment.authorRole ? (
            <span className="text-muted-foreground">
              {ROLE_LABEL[comment.authorRole as TeamRole]}
            </span>
          ) : null}
          <span aria-hidden className="text-muted-foreground/60">
            ·
          </span>
          <span className="text-muted-foreground">
            {formatRelative(comment.createdAt)}
          </span>
          {comment.editedAt ? (
            <span className="text-muted-foreground/80" title="Edited">
              · edited
            </span>
          ) : null}
        </div>
        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={draft}
              maxLength={COMMENT_MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[60px] text-sm"
              disabled={isPending}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={onSaveEdit}
                disabled={isPending || draft.trim().length === 0}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.bodyText ?? "")
                  setIsEditing(false)
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "mt-0.5 text-sm break-words whitespace-pre-wrap",
              isPending && "opacity-60"
            )}
          >
            {comment.bodyText}
          </p>
        )}
      </div>
      {isOwn && !isEditing ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Comment actions"
              className="mt-0.5 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal aria-hidden className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onSelect={() => setIsEditing(true)}>
              <Pencil aria-hidden className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 aria-hidden className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
