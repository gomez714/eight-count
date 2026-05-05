"use client";

import { Check, Clock, FileText, Mic } from "lucide-react";
import type { CSSProperties } from "react";

import { AudienceChips } from "@/components/audience-chips";
import { NoteActionsMenu } from "@/components/note-actions-menu";
import { NoteProgressBar } from "@/components/note-progress-bar";
import { NoteRehearsalLink } from "@/components/note-rehearsal-link";
import { NoteTimestampPill } from "@/components/note-timestamp-pill";
import { TagChip } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { VoiceNotePlayer } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-player";
import { formatNoteTimestamp } from "@/lib/notes/format";
import { cn } from "@/lib/utils";

import { RecipientPipRow } from "./recipient-pip-row";
import type { AuthoredNoteRow } from "./types";

type AuthoredNoteCardProps = {
  row: AuthoredNoteRow;
  onEdit: (row: AuthoredNoteRow) => void;
  onDelete: (row: AuthoredNoteRow) => void | Promise<void>;
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

function buildPendingDeleteWarning(
  row: AuthoredNoteRow
): string | undefined {
  const total = row.assignments.length;
  if (total === 0) return undefined;
  const engaged = row.assignments.filter((a) => a.status !== "OPEN").length;
  if (engaged === 0) return undefined;
  const noun = engaged === 1 ? "person has" : "people have";
  return `${engaged} ${noun} already responded to this note. Deleting it will remove their progress permanently.`;
}

export function AuthoredNoteCard({
  row,
  onEdit,
  onDelete,
}: Readonly<AuthoredNoteCardProps>) {
  const isVoice = row.noteType === "VOICE";
  const accent = isVoice ? "var(--note-voice-accent)" : "var(--primary)";
  const createdAt = new Date(row.createdAt);

  const totalAssignments = row.assignments.length;
  const addressed =
    row.assignmentCounts.ADDRESSED + row.assignmentCounts.RESOLVED;
  const isUnassigned = totalAssignments === 0;
  const isComplete = totalAssignments > 0 && addressed === totalAssignments;

  // Hide individual USER targets from the audience chip strip — the recipient
  // pip row below already names them, and showing them twice creates noise.
  const audienceTargets = row.targets.filter(
    (target) => target.kind !== "USER"
  );

  const stripeStyle: CSSProperties = { backgroundColor: accent };

  const cardClass = cn(
    "relative overflow-hidden rounded-lg border bg-card",
    row.stalled && "border-[color:var(--status-progress-border)]"
  );

  return (
    <article data-stalled={row.stalled || undefined} className={cardClass}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={stripeStyle} />

      <div className="flex flex-col gap-3 pl-5 pr-4 py-4">
        {/* Top meta */}
        <div className="flex flex-wrap items-center gap-2">
          <NoteRehearsalLink rehearsal={row.rehearsal} />
          <NoteTimestampPill
            timestampMs={row.startTimestampMs}
            noteType={row.noteType}
          />
          {row.tag ? <TagChip tag={row.tag} /> : null}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {isVoice ? (
              <>
                <Mic aria-hidden className="size-3" />
                Voice
                {row.audioAsset?.durationMs != null
                  ? ` · ${formatNoteTimestamp(row.audioAsset.durationMs)}`
                  : null}
              </>
            ) : (
              <>
                <FileText aria-hidden className="size-3" /> Note
              </>
            )}
          </span>
          {row.stalled ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--status-progress-bg)",
                color: "var(--status-progress-fg)",
                borderColor: "var(--status-progress-border)",
              }}
            >
              <Clock aria-hidden className="size-3" /> Stalled
            </span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatRelativeAge(createdAt)}
          </span>
          <NoteActionsMenu
            onEdit={() => onEdit(row)}
            onDelete={() => onDelete(row)}
            pendingDeleteWarning={buildPendingDeleteWarning(row)}
          />
        </div>

        {/* Audience + body */}
        <div className="flex flex-col gap-2">
          {audienceTargets.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sent to
              </span>
              <AudienceChips targets={audienceTargets} className="gap-1" />
            </div>
          ) : null}
          {isVoice && row.audioAsset ? (
            <VoiceNotePlayer
              audioAssetId={row.audioAsset.id}
              durationMs={row.audioAsset.durationMs}
            />
          ) : (
            <p className="line-clamp-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">
              {row.bodyText}
            </p>
          )}
        </div>

        {/* Progress block */}
        {isUnassigned ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 p-3">
            <span className="flex-1 text-xs text-muted-foreground">
              Not assigned to any specific dancer yet — visible to{" "}
              {row.targets.some((t) => t.kind === "EVERYONE")
                ? "the full cast"
                : row.targets.some((t) => t.kind === "GROUP")
                  ? "the group"
                  : "no one"}
              , but no one is on the hook.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(row)}
            >
              Assign
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-semibold tabular-nums",
                  isComplete ? "" : "text-foreground"
                )}
                style={
                  isComplete ? { color: "var(--status-resolved-fg)" } : undefined
                }
              >
                {addressed}
                <span className="font-medium text-muted-foreground">
                  /{totalAssignments}
                </span>{" "}
                addressed
              </span>
              <div className="min-w-0 flex-1">
                <NoteProgressBar counts={row.assignmentCounts} height={6} />
              </div>
              {isComplete ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--status-resolved-bg)",
                    color: "var(--status-resolved-fg)",
                    borderColor: "var(--status-resolved-border)",
                  }}
                >
                  <Check aria-hidden className="size-3" /> Complete
                </span>
              ) : null}
            </div>

            <RecipientPipRow assignments={row.assignments} stalled={row.stalled} />
          </div>
        )}
      </div>
    </article>
  );
}
