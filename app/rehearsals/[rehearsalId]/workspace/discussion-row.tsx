"use client";

import { FileText, Mic, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { RefObject } from "react";
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
import type { DeleteDiscussionResponse } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

import type { DiscussionItem } from "./types";
import { VoiceNotePlayer } from "./voice-note-player";
import { VoiceNoteTranscript } from "./voice-note-transcript";

type DiscussionRowProps = {
  discussion: DiscussionItem;
  currentUserId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onJumpToTimestamp: (timestampMs: number) => void;
  onSyncPlaybackChange: (audioAssetId: string, isPlaying: boolean) => void;
  onDeleted: () => void;
  /** When true (author or staff), renders the Try-again retry button on FAILED transcripts. */
  canRetryTranscript: boolean;
};

export function DiscussionRow({
  discussion,
  currentUserId,
  videoRef,
  onJumpToTimestamp,
  onSyncPlaybackChange,
  onDeleted,
  canRetryTranscript,
}: Readonly<DiscussionRowProps>) {
  const [isPending, startTransition] = useTransition();
  const isVoice = discussion.noteType === "VOICE";
  const isAuthor = discussion.author.id === currentUserId;
  const isAnchored = discussion.startTimestampMs !== null;
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
        "flex flex-col gap-3 rounded-lg border-l-2 bg-card p-3 sm:flex-row sm:gap-4 sm:p-4",
        isPending && "opacity-60"
      )}
      style={{ borderLeftColor: accent }}
    >
      {/* Left rail — timestamp pill (when anchored) + media-type label.
          Mirrors the NoteRow leading column for visual cohesion. */}
      <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
        {isAnchored && discussion.startTimestampMs !== null ? (
          <NoteTimestampPill
            timestampMs={discussion.startTimestampMs}
            noteType={discussion.noteType}
            tone="discussion"
            onClick={() => {
              if (discussion.startTimestampMs !== null) {
                onJumpToTimestamp(discussion.startTimestampMs);
              }
            }}
          />
        ) : (
          <span
            className="rounded-md border border-dashed px-2 py-1 font-mono text-xs text-muted-foreground"
            style={{
              borderColor:
                "color-mix(in oklch, var(--discussion-accent) 30%, transparent)",
            }}
          >
            No anchor
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground sm:pl-2">
          {isVoice ? (
            <Mic className="size-2.5" />
          ) : (
            <FileText className="size-2.5" />
          )}
          {isVoice ? "Voice" : "Text"}
        </span>
      </div>

      {/* Body — author, body/voice, thread attachment */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <AvatarInitials
            name={discussion.author.name}
            fallback={discussion.author.email}
            toneSeed={discussion.author.id}
            size={24}
          />
          <span className="text-sm font-semibold">
            {discussion.author.name || discussion.author.email}
          </span>
          {isAuthor ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Discussion actions"
                  className="ml-auto size-7 p-0"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                {/* Edit lives on the project page in v1 — workspace edits ship in a follow-up. */}
                <DropdownMenuItem disabled>
                  <Pencil aria-hidden className="size-3.5" />
                  Edit (coming soon)
                </DropdownMenuItem>
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

        {isVoice && discussion.audioAsset ? (
          <VoiceNotePlayer
            audioAssetId={discussion.audioAsset.id}
            durationMs={discussion.audioAsset.durationMs}
            videoRef={videoRef}
            startTimestampMs={discussion.startTimestampMs ?? undefined}
            onSyncPlaybackChange={onSyncPlaybackChange}
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
          <p className="text-sm leading-relaxed text-foreground">
            {discussion.bodyText}
          </p>
        )}

        {!isAnchored ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ backgroundColor: "var(--discussion-accent)" }}
              aria-hidden
            />
            Rehearsal-wide · no video anchor
          </span>
        ) : null}

        <span className="text-[11px] text-muted-foreground">
          {formatRelativeOrAbsolute(discussion.createdAt)}
        </span>

        <ThreadAttachment
          target={{ type: "discussion", id: discussion.id }}
          viewerId={currentUserId}
          initialCommentCount={discussion.thread.commentCount}
          initialReactions={discussion.thread.reactions}
          initialHasUnread={discussion.thread.hasUnread}
          showStartHint
        />
      </div>
    </article>
  );
}

function formatRelativeOrAbsolute(value: string | Date): string {
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
