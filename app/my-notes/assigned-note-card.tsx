"use client";

import { ArrowRight, User } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";

import { AudienceChips } from "@/components/audience-chips";
import { AvatarInitials } from "@/components/avatar-initials";
import { NoteRehearsalLink } from "@/components/note-rehearsal-link";
import { NoteTimestampPill } from "@/components/note-timestamp-pill";
import { RepeatingChip } from "@/components/repeating-chip";
import { TagChip } from "@/components/tag-chip";
import { VoiceNotePlayer } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-player";
import { VoiceNoteTranscript } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-transcript";
import { cn } from "@/lib/utils";

import { updateNoteAssignmentStatus } from "./note-status-actions";
import { StatusSegmented } from "./status-segmented";
import {
  NOTE_STATUS_LABELS,
  type AssignedNoteRow,
  type NoteStatus,
} from "./types";

type AssignedNoteCardProps = {
  row: AssignedNoteRow;
  hero?: boolean;
};

function formatRelativeAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function AssignedNoteCard({
  row,
  hero = false,
}: Readonly<AssignedNoteCardProps>) {
  const [isPending, startTransition] = useTransition();
  const { note, status } = row;

  const isVoice = note.noteType === "VOICE";
  const accent = isVoice ? "var(--note-voice-accent)" : "var(--primary)";

  const noteCreatedAt = new Date(note.createdAt);
  const noteUpdatedAt = new Date(note.updatedAt);
  const wasEdited = noteUpdatedAt.getTime() - noteCreatedAt.getTime() > 1000;

  // The user's own USER target is implicit (the note is in their inbox);
  // surface only EVERYONE / GROUP audience so they understand the broader scope.
  const audienceTargets = note.targets.filter(
    (target) => target.kind !== "USER"
  );

  const handleStatusChange = (next: NoteStatus) => {
    startTransition(async () => {
      const result = await updateNoteAssignmentStatus({
        noteAssignmentId: row.id,
        status: next,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Marked as ${NOTE_STATUS_LABELS[next]}.`);
    });
  };

  const stripeStyle: CSSProperties = { backgroundColor: accent };

  return (
    <article
      data-hero={hero ? "true" : undefined}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card",
        hero && "border-primary/40 shadow-sm"
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={stripeStyle} />

      <div
        className={cn(
          "flex flex-col gap-3",
          hero ? "pl-6 pr-5 py-5" : "pl-5 pr-4 py-4"
        )}
      >
        {/* Top meta: rehearsal context + timestamp + tag + repeating + relative age */}
        <div className="flex flex-wrap items-center gap-2.5">
          <NoteRehearsalLink rehearsal={note.rehearsal} />
          <NoteTimestampPill
            timestampMs={note.startTimestampMs}
            noteType={note.noteType}
          />
          {note.tag ? <TagChip tag={note.tag} /> : null}
          {row.repeating ? (
            <RepeatingChip
              tag={row.repeating.tag}
              count={row.repeating.count}
            />
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatRelativeAge(noteCreatedAt)}
            {wasEdited ? (
              <>
                {" · "}
                <span
                  className="italic"
                  title={`Edited ${new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(noteUpdatedAt)}`}
                >
                  Edited
                </span>
              </>
            ) : null}
          </span>
        </div>

        {/* Author + audience */}
        <div className="flex flex-wrap items-center gap-2">
          <AvatarInitials
            name={note.author.name}
            fallback={note.author.email}
            toneSeed={note.author.id}
            size={22}
          />
          <span className="text-sm font-semibold">
            {note.author.name || note.author.email}
          </span>
          <span aria-hidden className="text-xs text-muted-foreground">
            →
          </span>
          {audienceTargets.length > 0 ? (
            <AudienceChips targets={audienceTargets} className="gap-1" />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              <User aria-hidden className="size-3" /> You
            </span>
          )}
        </div>

        {/* Body */}
        {isVoice && note.audioAsset ? (
          <VoiceNotePlayer
            audioAssetId={note.audioAsset.id}
            durationMs={note.audioAsset.durationMs}
            transcriptSlot={
              <VoiceNoteTranscript
                audioAssetId={note.audioAsset.id}
                initialStatus={note.audioAsset.transcriptStatus}
                initialTranscript={note.audioAsset.transcript}
                canRetry={false}
              />
            }
          />
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap text-foreground",
              hero ? "text-[15px] font-medium leading-relaxed" : "text-sm leading-relaxed"
            )}
          >
            {note.bodyText}
          </p>
        )}

        {/* Action row: segmented + jump-to-rehearsal */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-dashed border-border pt-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mark as
          </span>
          <StatusSegmented
            value={status}
            onChange={handleStatusChange}
            disabled={isPending}
            size={hero ? "md" : "sm"}
          />
          <Link
            href={`/rehearsals/${note.rehearsal.id}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Open in rehearsal
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
