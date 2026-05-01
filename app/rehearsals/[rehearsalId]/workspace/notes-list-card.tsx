"use client";

import { FileText, Mic } from "lucide-react";
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
import type { NoteStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import { StatusChip } from "./status-chip";
import type { AssignableMember, NoteItem } from "./types";
import { formatTimestamp } from "./utils";
import { VoiceNotePlayer } from "./voice-note-player";

type PillFilter =
  | "ALL"
  | "OPEN"
  | "IN_PROGRESS"
  | "ADDRESSED"
  | "RESOLVED"
  | "UNASSIGNED"
  | "VOICE"
  | "MINE";

const PILL_FILTER_LABELS: Record<PillFilter, string> = {
  ALL: "All",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ADDRESSED: "Addressed",
  RESOLVED: "Resolved",
  UNASSIGNED: "Unassigned",
  VOICE: "Voice",
  MINE: "@ me",
};

const PILL_FILTER_ORDER: PillFilter[] = [
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "ADDRESSED",
  "RESOLVED",
  "UNASSIGNED",
  "VOICE",
  "MINE",
];

function matchesPillFilter(
  note: NoteItem,
  filter: PillFilter,
  currentUserId: string
): boolean {
  if (filter === "ALL") return true;
  if (filter === "UNASSIGNED") return note.assignments.length === 0;
  if (filter === "VOICE") return note.noteType === "VOICE";
  if (filter === "MINE") {
    return note.assignments.some(
      (assignment) => assignment.user.id === currentUserId
    );
  }
  // Status filters: note matches if any assignment has that status.
  return note.assignments.some(
    (assignment) => (assignment.status?.status ?? "OPEN") === filter
  );
}

type FilterCounts = Record<PillFilter, number>;

function computeFilterCounts(
  notes: NoteItem[],
  currentUserId: string
): FilterCounts {
  const counts: FilterCounts = {
    ALL: notes.length,
    OPEN: 0,
    IN_PROGRESS: 0,
    ADDRESSED: 0,
    RESOLVED: 0,
    UNASSIGNED: 0,
    VOICE: 0,
    MINE: 0,
  };
  for (const note of notes) {
    if (note.noteType === "VOICE") counts.VOICE += 1;
    if (note.assignments.length === 0) counts.UNASSIGNED += 1;
    if (
      note.assignments.some(
        (assignment) => assignment.user.id === currentUserId
      )
    ) {
      counts.MINE += 1;
    }
    const seen = new Set<NoteStatus>();
    for (const assignment of note.assignments) {
      seen.add(assignment.status?.status ?? "OPEN");
    }
    for (const status of seen) {
      counts[status] += 1;
    }
  }
  return counts;
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
  const isVoice = note.noteType === "VOICE";
  const accent = isVoice ? "var(--note-voice-accent)" : "var(--primary)";

  return (
    <article className="relative grid grid-cols-[84px_1fr] gap-4 rounded-lg border bg-card p-4 pl-3.5">
      <span
        aria-hidden
        className="absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-r"
        style={{ backgroundColor: accent }}
      />

      <button
        type="button"
        onClick={() => onJumpToTimestamp(note.startTimestampMs)}
        aria-label={`Jump to ${formatTimestamp(note.startTimestampMs)}`}
        className="flex flex-col items-start gap-1 rounded text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className="rounded-md px-2 py-1 font-mono text-sm font-semibold"
          style={{
            backgroundColor: `color-mix(in oklch, ${accent} 12%, transparent)`,
            color: "var(--foreground)",
          }}
        >
          {formatTimestamp(note.startTimestampMs)}
        </span>
        <span className="inline-flex items-center gap-1 pl-2 text-[10.5px] text-muted-foreground">
          {isVoice ? <Mic className="size-2.5" /> : <FileText className="size-2.5" />}
          {isVoice ? "Voice" : "Note"}
        </span>
      </button>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {note.author.name || note.author.email}
          </span>
          {canEdit ? (
            <div className="ml-auto">
              <NoteActionsMenu
                onEdit={() => onEdit(note)}
                onDelete={() => onDelete(note)}
                pendingDeleteWarning={buildPendingDeleteWarning(note)}
              />
            </div>
          ) : null}
        </div>

        {isVoice && note.audioAsset ? (
          <VoiceNotePlayer
            audioAssetId={note.audioAsset.id}
            durationMs={note.audioAsset.durationMs}
            videoRef={videoRef}
            startTimestampMs={note.startTimestampMs}
          />
        ) : (
          <p className="text-sm leading-relaxed text-foreground">
            {note.bodyText}
          </p>
        )}

        {hasAudienceIntent ? (
          <AudienceChips targets={audienceTargets} />
        ) : null}

        {hasAssignments ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
            <span className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
              Assigned
            </span>
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
          <span className="inline-flex w-fit items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
            Unassigned
          </span>
        ) : null}
      </div>
    </article>
  );
}

type FilterPillProps = {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function FilterPill({ label, count, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active || undefined}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      <span>{label}</span>
      {active ? null : (
        <span className="text-[10.5px] font-semibold tabular-nums opacity-60">
          {count}
        </span>
      )}
    </button>
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
  const [pillFilter, setPillFilter] = useState<PillFilter>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

  const filterCounts = useMemo(
    () => computeFilterCounts(notes, currentUserId),
    [notes, currentUserId]
  );

  const filteredNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        matchesPillFilter(note, pillFilter, currentUserId) &&
        matchesAssignee(note, assigneeFilter)
    );
  }, [notes, pillFilter, assigneeFilter, currentUserId]);

  const isAssigneeFilterDisabled =
    pillFilter === "UNASSIGNED" || assignableMembers.length === 0;

  const hasActiveFilters =
    pillFilter !== "ALL" || assigneeFilter !== "ALL";

  const clearFilters = () => {
    setPillFilter("ALL");
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {PILL_FILTER_ORDER.map((key) => (
              <FilterPill
                key={key}
                label={PILL_FILTER_LABELS[key]}
                count={filterCounts[key]}
                active={pillFilter === key}
                onClick={() => {
                  setPillFilter(key);
                  if (key === "UNASSIGNED") {
                    setAssigneeFilter("ALL");
                  }
                }}
              />
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
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

            <span className="text-xs tabular-nums text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {filteredNotes.length}
              </span>{" "}
              of {notes.length}
            </span>

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
        </div>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
    </Card>
  );
}
