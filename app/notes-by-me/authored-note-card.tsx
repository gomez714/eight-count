"use client";

import Link from "next/link";

import { AudienceChips } from "@/components/audience-chips";
import { NoteActionsMenu } from "@/components/note-actions-menu";
import { VoiceNotePlayer } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-player";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isActiveStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import type { AuthoredNoteRow } from "./types";

type AuthoredNoteCardProps = {
  row: AuthoredNoteRow;
  onEdit: (row: AuthoredNoteRow) => void;
  onDelete: (row: AuthoredNoteRow) => void | Promise<void>;
};

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
}: AuthoredNoteCardProps) {
  const rehearsalDate = new Date(row.rehearsal.rehearsalDate);

  const totalAssignments = row.assignments.length;
  const addressedCount = row.assignments.filter(
    (assignment) => !isActiveStatus(assignment.status)
  ).length;
  const allAddressed =
    totalAssignments > 0 && addressedCount === totalAssignments;

  // Show audience intent (Full cast, groups) at the top.
  const audienceTargets = row.targets.filter(
    (target) => target.kind !== "USER"
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {row.rehearsal.project.team.name}
            </p>
            <CardTitle className="text-base">
              <Link
                href={`/rehearsals/${row.rehearsal.id}`}
                className="hover:underline"
              >
                {row.rehearsal.project.title}
                <span className="text-muted-foreground"> · </span>
                {row.rehearsal.title}
              </Link>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
              }).format(rehearsalDate)}
              {" · "}
              <span className="font-medium">
                {formatTimestamp(row.startTimestampMs)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {totalAssignments > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  allAddressed
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground"
                )}
                data-progress={allAddressed ? "complete" : "in-progress"}
              >
                {addressedCount}/{totalAssignments} addressed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
                Unassigned
              </span>
            )}
            <NoteActionsMenu
              onEdit={() => onEdit(row)}
              onDelete={() => onDelete(row)}
              pendingDeleteWarning={buildPendingDeleteWarning(row)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {row.noteType === "VOICE" && row.audioAsset ? (
          <VoiceNotePlayer
            audioAssetId={row.audioAsset.id}
            durationMs={row.audioAsset.durationMs}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{row.bodyText}</p>
        )}
        {audienceTargets.length > 0 ? (
          <AudienceChips targets={audienceTargets} />
        ) : null}
      </CardContent>
    </Card>
  );
}
