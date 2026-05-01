"use client";

import { useMemo, useState } from "react";

import { AudienceChips } from "@/components/audience-chips";
import { NoteActionsMenu } from "@/components/note-actions-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isActiveStatus } from "@/lib/notes/statuses";

import { StatusChip } from "./status-chip";
import type { AssignableMember, NoteItem } from "./types";
import { formatTimestamp } from "./utils";
import { VoiceNotePlayer } from "./voice-note-player";

type StatusFilter = "ALL" | "UNRESOLVED" | "RESOLVED" | "UNASSIGNED";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "All",
  UNRESOLVED: "Unresolved",
  RESOLVED: "Resolved",
  UNASSIGNED: "Unassigned",
};

const STATUS_FILTER_ORDER: StatusFilter[] = [
  "ALL",
  "UNRESOLVED",
  "RESOLVED",
  "UNASSIGNED",
];

function matchesStatus(note: NoteItem, filter: StatusFilter): boolean {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "UNASSIGNED") {
    return note.assignments.length === 0;
  }

  if (note.assignments.length === 0) {
    return false;
  }

  const hasActive = note.assignments.some((assignment) =>
    isActiveStatus(assignment.status?.status ?? "OPEN")
  );

  return filter === "UNRESOLVED" ? hasActive : !hasActive;
}

function matchesAssignee(note: NoteItem, assigneeUserId: string): boolean {
  if (assigneeUserId === "ALL") {
    return true;
  }

  return note.assignments.some(
    (assignment) => assignment.user.id === assigneeUserId
  );
}

function buildPendingDeleteWarning(note: NoteItem): string | undefined {
  const total = note.assignments.length;
  if (total === 0) return undefined;
  const engaged = note.assignments.filter(
    (assignment) =>
      assignment.status && assignment.status.status !== "OPEN"
  ).length;
  if (engaged === 0) return undefined;
  const noun = engaged === 1 ? "person has" : "people have";
  return `${engaged} ${noun} already responded to this note. Deleting it will remove their progress permanently.`;
}

type NoteRowProps = {
  note: NoteItem;
  canEdit: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onJumpToTimestamp: (timestampMs: number) => void;
  onEdit: (note: NoteItem) => void;
  onDelete: (note: NoteItem) => void | Promise<void>;
};

function NoteRow({
  note,
  canEdit,
  videoRef,
  onJumpToTimestamp,
  onEdit,
  onDelete,
}: NoteRowProps) {
  // Audience targets that aren't individual users — these convey intent
  // (e.g. "Full cast", "Front line") that the per-user status chips below
  // can't express. Individual USER targets are already represented via
  // their per-recipient status chip, so we omit them here to avoid
  // redundancy.
  const audienceTargets = note.targets.filter(
    (target) => target.kind !== "USER"
  );

  const hasAudienceIntent = audienceTargets.length > 0;
  const hasAssignments = note.assignments.length > 0;

  return (
    <article className="flex w-full flex-col rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onJumpToTimestamp(note.startTimestampMs)}
          className="rounded font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Jump to ${formatTimestamp(note.startTimestampMs)}`}
        >
          {formatTimestamp(note.startTimestampMs)}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {note.author.name || note.author.email}
          </span>
          {canEdit ? (
            <NoteActionsMenu
              onEdit={() => onEdit(note)}
              onDelete={() => onDelete(note)}
              pendingDeleteWarning={buildPendingDeleteWarning(note)}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        {note.noteType === "VOICE" && note.audioAsset ? (
          <VoiceNotePlayer
            audioAssetId={note.audioAsset.id}
            durationMs={note.audioAsset.durationMs}
            videoRef={videoRef}
            startTimestampMs={note.startTimestampMs}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{note.bodyText}</p>
        )}
      </div>

      {hasAudienceIntent ? (
        <AudienceChips className="mt-3" targets={audienceTargets} />
      ) : null}

      {hasAssignments ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.assignments.map((assignment) => {
            const status = assignment.status?.status ?? "OPEN";
            const label = assignment.user.name || assignment.user.email;

            return (
              <StatusChip
                key={assignment.id}
                status={status}
                label={label}
              />
            );
          })}
        </div>
      ) : null}

      {!hasAudienceIntent && !hasAssignments ? (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
            Unassigned
          </span>
        </div>
      ) : null}
    </article>
  );
}

type NotesListCardProps = {
  notes: NoteItem[];
  assignableMembers: AssignableMember[];
  currentUserId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onJumpToTimestamp: (timestampMs: number) => void;
  onEditNote: (note: NoteItem) => void;
  onDeleteNote: (note: NoteItem) => void | Promise<void>;
};

export function NotesListCard({
  notes,
  assignableMembers,
  currentUserId,
  videoRef,
  onJumpToTimestamp,
  onEditNote,
  onDeleteNote,
}: NotesListCardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

  const filteredNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        matchesStatus(note, statusFilter) &&
        matchesAssignee(note, assigneeFilter)
    );
  }, [notes, statusFilter, assigneeFilter]);

  const isAssigneeFilterDisabled =
    statusFilter === "UNASSIGNED" || assignableMembers.length === 0;

  const hasActiveFilters =
    statusFilter !== "ALL" || assigneeFilter !== "ALL";

  const clearFilters = () => {
    setStatusFilter("ALL");
    setAssigneeFilter("ALL");
  };

  const selectedAssigneeMember = assignableMembers.find(
    (member) => member.id === assigneeFilter
  );
  const assigneeFilterLabel =
    assigneeFilter === "ALL"
      ? "All"
      : selectedAssigneeMember?.name ||
        selectedAssigneeMember?.email ||
        "All";

  const renderBody = () => {
    if (notes.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No notes yet. Add the first one above.
        </p>
      );
    }

    if (filteredNotes.length === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No notes match the current filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            canEdit={note.author.id === currentUserId}
            videoRef={videoRef}
            onJumpToTimestamp={onJumpToTimestamp}
            onEdit={onEditNote}
            onDelete={onDeleteNote}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Timestamped feedback for this rehearsal video.
        </CardDescription>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const next = value as StatusFilter;
              setStatusFilter(next);
              if (next === "UNASSIGNED") {
                setAssigneeFilter("ALL");
              }
            }}
          >
            <SelectTrigger size="sm" aria-label="Filter by status">
              <SelectValue>
                Status: {STATUS_FILTER_LABELS[statusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_ORDER.map((option) => (
                <SelectItem key={option} value={option}>
                  {STATUS_FILTER_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
            disabled={isAssigneeFilterDisabled}
          >
            <SelectTrigger size="sm" aria-label="Filter by assignee">
              <SelectValue>Assignee: {assigneeFilterLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {assignableMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name || member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
    </Card>
  );
}
