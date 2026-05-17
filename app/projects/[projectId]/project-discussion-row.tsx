"use client";

import { FileText, MessagesSquare, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { NoteTimestampPill } from "@/components/note-timestamp-pill";
import { ThreadAttachment } from "@/components/threads/thread-attachment";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoiceNotePlayer } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-player";
import { VoiceNoteTranscript } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-transcript";
import type {
  DeleteDiscussionResponse,
} from "@/lib/api/contracts";
import type { ThreadReactionSummary } from "@/lib/threads/comments";
import { cn } from "@/lib/utils";

/**
 * Project-page shape for a Discussion. Includes the rolled-up rehearsal
 * context (when set) so each row can show "Rehearsal: {title}" or
 * "Project-wide". Mirrors the workspace `DiscussionItem` but the rehearsal
 * context is the load-bearing addition.
 */
export type ProjectDiscussionItem = {
  id: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  startTimestampMs: number | null;
  endTimestampMs: number | null;
  audioAsset: {
    id: string;
    mimeType: string;
    durationMs: number | null;
    status: "UPLOADING" | "READY" | "FAILED";
    transcript: string | null;
    transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  } | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  /** null = true project-level. Set = rehearsal-anchored, rolled up here. */
  rehearsal: { id: string; title: string } | null;
  thread: {
    commentCount: number;
    reactions: ThreadReactionSummary[];
    hasUnread: boolean;
  };
};

type ProjectDiscussionRowProps = {
  discussion: ProjectDiscussionItem;
  currentUserId: string;
  /** Author-or-staff per the API gate. Drives the transcript-retry button. */
  canRetryTranscript: boolean;
  onDeleted: () => void;
};

export function ProjectDiscussionRow({
  discussion,
  currentUserId,
  canRetryTranscript,
  onDeleted,
}: Readonly<ProjectDiscussionRowProps>) {
  const [isPending, startTransition] = useTransition();
  const isVoice = discussion.noteType === "VOICE";
  const isAuthor = discussion.author.id === currentUserId;
  const accent = isVoice
    ? "var(--note-voice-accent)"
    : "var(--discussion-accent)";

  const handleDelete = () => {
    if (!window.confirm("Delete this discussion?")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/discussions/${discussion.id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as DeleteDiscussionResponse;
        if (!data.ok) throw new Error(data.error.message);
        toast.success("Discussion deleted");
        onDeleted();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete discussion."
        );
      }
    });
  };

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border-l-2 bg-card p-3 sm:p-4",
        isPending && "opacity-60"
      )}
      style={{ borderLeftColor: accent }}
    >
      {/* Top meta row — author, rehearsal context, optional timestamp,
          actions menu. */}
      <div className="flex flex-wrap items-center gap-2">
        <AvatarInitials
          name={discussion.author.name}
          fallback={discussion.author.email}
          toneSeed={discussion.author.id}
          size={24}
        />
        <span className="text-sm font-semibold">
          {discussion.author.name || discussion.author.email}
        </span>

        <ScopeBadge rehearsal={discussion.rehearsal} />

        {discussion.startTimestampMs !== null && discussion.rehearsal ? (
          // Anchored: pill links to the rehearsal workspace. Deep-linking
          // to the exact moment via `?t=` is deferred — for now the user
          // lands on the rehearsal and can click the discussion's
          // timestamp pill there to jump.
          <Link
            href={`/rehearsals/${discussion.rehearsal.id}`}
            aria-label={`Open rehearsal ${discussion.rehearsal.title}`}
          >
            <NoteTimestampPill
              timestampMs={discussion.startTimestampMs}
              noteType={discussion.noteType}
              tone="discussion"
            />
          </Link>
        ) : null}

        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatRelative(discussion.createdAt)}
        </span>

        {isAuthor ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Discussion actions"
                className="size-7 p-0"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem
                variant="destructive"
                onSelect={handleDelete}
                disabled={isPending}
              >
                <Trash2 aria-hidden className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Body — text or voice. No video sync on the project page (no
          video player in scope), so VoiceNotePlayer runs in standalone
          mode (lazy-fetches the playback URL on first play). */}
      {isVoice && discussion.audioAsset ? (
        <VoiceNotePlayer
          audioAssetId={discussion.audioAsset.id}
          durationMs={discussion.audioAsset.durationMs}
          transcriptSlot={
            <VoiceNoteTranscript
              audioAssetId={discussion.audioAsset.id}
              initialStatus={discussion.audioAsset.transcriptStatus}
              initialTranscript={discussion.audioAsset.transcript}
              canRetry={canRetryTranscript}
            />
          }
        />
      ) : (
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {discussion.bodyText}
        </p>
      )}

      <ThreadAttachment
        target={{ type: "discussion", id: discussion.id }}
        viewerId={currentUserId}
        initialCommentCount={discussion.thread.commentCount}
        initialReactions={discussion.thread.reactions}
        initialHasUnread={discussion.thread.hasUnread}
        showStartHint
      />
    </article>
  );
}

function ScopeBadge({
  rehearsal,
}: Readonly<{ rehearsal: ProjectDiscussionItem["rehearsal"] }>) {
  if (rehearsal === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--discussion-accent) 12%, var(--card))",
          borderColor:
            "color-mix(in oklch, var(--discussion-accent) 30%, transparent)",
          color: "var(--discussion-accent)",
        }}
      >
        <MessagesSquare className="size-3" aria-hidden />
        Project-wide
      </span>
    );
  }
  return (
    <Link
      href={`/rehearsals/${rehearsal.id}`}
      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      title={`Open rehearsal ${rehearsal.title}`}
    >
      <FileText className="size-3" aria-hidden />
      Rehearsal: <span className="max-w-56 truncate">{rehearsal.title}</span>
    </Link>
  );
}

// Inline so this file is self-contained. Same shape as the workspace
// row's relative formatter.
function formatRelative(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(Math.max(0, diffMs) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}
