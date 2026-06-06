"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  EditNoteSheet,
  type EditNoteFormValues,
  type EditableNote,
} from "@/components/edit-note-sheet";
import { ThreadExpansionProvider } from "@/components/threads/thread-expansion-context";
import type {
  AssignableMember,
  AvailableGroup,
} from "@/app/rehearsals/[rehearsalId]/workspace/types";
import type {
  AudienceResponse,
  DeleteNoteResponse,
  NoteTargetInput,
  UpdateNoteRequest,
  UpdateNoteResponse,
} from "@/lib/api/contracts";
import type { NoteStatus } from "@/lib/notes/statuses";
import type { NoteTag } from "@/lib/notes/tags";

import { AuthoredNoteCard } from "./authored-note-card";
import { AuthorSummaryStrip } from "./author-summary-strip";
import { FilterSortBar, type TagFilterOption } from "./filter-sort-bar";
import type {
  AuthoredAssignmentCounts,
  AuthoredNoteFilter,
  AuthoredNoteRow,
  AuthoredNoteSort,
} from "./types";

type FilterCounts = Record<AuthoredNoteFilter, number>;

function isOutstanding(row: AuthoredNoteRow): boolean {
  if (row.assignments.length === 0) return false;
  return (
    row.assignmentCounts.OPEN > 0 || row.assignmentCounts.IN_PROGRESS > 0
  );
}

function isComplete(row: AuthoredNoteRow): boolean {
  if (row.assignments.length === 0) return false;
  return (
    row.assignmentCounts.OPEN === 0 && row.assignmentCounts.IN_PROGRESS === 0
  );
}

function rowMatchesFilter(
  row: AuthoredNoteRow,
  filter: AuthoredNoteFilter
): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "OUTSTANDING":
      return isOutstanding(row);
    case "STALLED":
      return row.stalled;
    case "COMPLETE":
      return isComplete(row);
    case "UNASSIGNED":
      return row.assignments.length === 0;
  }
}

function rowMatchesTag(row: AuthoredNoteRow, tag: NoteTag | null): boolean {
  if (tag === null) return true;
  return row.tag === tag;
}

function compareRows(
  a: AuthoredNoteRow,
  b: AuthoredNoteRow,
  sort: AuthoredNoteSort
): number {
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();

  if (sort === "OLDEST") return ta - tb;
  if (sort === "RECENT") return tb - ta;
  // STALLED_FIRST
  const aw = a.stalled ? 1 : 0;
  const bw = b.stalled ? 1 : 0;
  if (aw !== bw) return bw - aw;
  return tb - ta;
}

function toEditableNote(row: AuthoredNoteRow): EditableNote {
  return {
    id: row.id,
    noteType: row.noteType,
    bodyText: row.bodyText,
    startTimestampMs: row.startTimestampMs,
    endTimestampMs: row.endTimestampMs,
    tag: row.tag,
    audioAsset: row.audioAsset
      ? {
          id: row.audioAsset.id,
          mimeType: row.audioAsset.mimeType,
          durationMs: row.audioAsset.durationMs,
        }
      : null,
    targets: row.targets.map((target) => ({
      kind: target.kind,
      user: target.user ? { id: target.user.id } : null,
      group: target.group ? { id: target.group.id } : null,
    })),
    assignments: row.assignments.map((assignment) => ({
      userId: assignment.user.id,
      status: assignment.status,
      displayName: assignment.user.name || assignment.user.email,
    })),
  };
}

function buildTargetsFromSelection(
  values: EditNoteFormValues
): NoteTargetInput[] {
  if (values.isFullCast) {
    return [{ kind: "EVERYONE" }];
  }
  return [
    ...values.selectedGroupIds.map((projectGroupId) => ({
      kind: "GROUP" as const,
      projectGroupId,
    })),
    ...values.selectedAssigneeUserIds.map((userId) => ({
      kind: "USER" as const,
      userId,
    })),
  ];
}

type NotesByMeListProps = {
  notes: AuthoredNoteRow[];
  viewerId: string;
};

export function NotesByMeList({ notes, viewerId }: Readonly<NotesByMeListProps>) {
  const router = useRouter();
  const [filter, setFilter] = useState<AuthoredNoteFilter>("OUTSTANDING");
  const [sort, setSort] = useState<AuthoredNoteSort>("STALLED_FIRST");
  const [tagFilter, setTagFilter] = useState<NoteTag | null>(null);

  const [editingRow, setEditingRow] = useState<AuthoredNoteRow | null>(null);
  const [audience, setAudience] = useState<{
    assignableMembers: AssignableMember[];
    availableGroups: AvailableGroup[];
  } | null>(null);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditPending, startEditTransition] = useTransition();

  // Aggregate metrics for the summary strip — computed across the entire
  // authored set so the strip stays stable as the filter changes.
  const summary = useMemo(() => {
    const aggregate: AuthoredAssignmentCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      ADDRESSED: 0,
      RESOLVED: 0,
    };
    let totalAssignments = 0;
    let addressed = 0;
    let stalledCount = 0;
    let unassignedCount = 0;
    const repeatingUserIds = new Set<string>();

    for (const row of notes) {
      if (row.assignments.length === 0) {
        unassignedCount += 1;
        continue;
      }
      if (row.stalled) stalledCount += 1;
      for (const status of [
        "OPEN",
        "IN_PROGRESS",
        "ADDRESSED",
        "RESOLVED",
      ] as NoteStatus[]) {
        aggregate[status] += row.assignmentCounts[status];
      }
      totalAssignments += row.assignments.length;
      addressed +=
        row.assignmentCounts.ADDRESSED + row.assignmentCounts.RESOLVED;
      for (const a of row.assignments) {
        if (a.repeating) repeatingUserIds.add(a.user.id);
      }
    }

    return {
      aggregate,
      totalAssignments,
      addressed,
      stalledCount,
      unassignedCount,
      repeatingDancerCount: repeatingUserIds.size,
    };
  }, [notes]);

  // Per-filter counts (totals, not narrowed by current filter).
  const filterCounts = useMemo<FilterCounts>(() => {
    const counts: FilterCounts = {
      ALL: notes.length,
      OUTSTANDING: 0,
      STALLED: 0,
      COMPLETE: 0,
      UNASSIGNED: 0,
    };
    for (const row of notes) {
      if (row.assignments.length === 0) {
        counts.UNASSIGNED += 1;
      } else if (isOutstanding(row)) {
        counts.OUTSTANDING += 1;
      } else {
        counts.COMPLETE += 1;
      }
      if (row.stalled) counts.STALLED += 1;
    }
    return counts;
  }, [notes]);

  const filteredAndSorted = useMemo(() => {
    return notes
      .filter((row) => rowMatchesFilter(row, filter) && rowMatchesTag(row, tagFilter))
      .sort((a, b) => compareRows(a, b, sort));
  }, [notes, filter, tagFilter, sort]);

  const tagOptions = useMemo<TagFilterOption[]>(() => {
    const counts = new Map<NoteTag, number>();
    for (const row of notes) {
      if (row.tag) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [notes]);

  const handleOpenEdit = async (row: AuthoredNoteRow) => {
    setEditingRow(row);
    setAudience(null);
    setEditError(null);
    setIsLoadingAudience(true);
    try {
      const response = await fetch(
        `/api/rehearsals/${row.rehearsal.id}/audience`
      );
      const data = (await response.json()) as AudienceResponse;
      if (!data.ok) {
        throw new Error(data.error.message);
      }
      setAudience({
        assignableMembers: data.data.assignableMembers,
        availableGroups: data.data.availableGroups,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load audience.";
      toast.error(message);
      setEditingRow(null);
    } finally {
      setIsLoadingAudience(false);
    }
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open) {
      setEditingRow(null);
      setAudience(null);
      setEditError(null);
    }
  };

  const handleSubmitEdit = (values: EditNoteFormValues) => {
    if (!editingRow) return;

    startEditTransition(async () => {
      try {
        setEditError(null);

        // Same null-pair semantics as the workspace edit handler. The
        // edit sheet returns null when the author un-anchored (or kept
        // an already-un-anchored note that way); the API treats null as
        // "clear" and numbers as "set".
        const requestBody: UpdateNoteRequest =
          editingRow.noteType === "VOICE"
            ? {
                noteType: "VOICE",
                startTimestampMs: values.startTimestampMs,
                endTimestampMs:
                  values.startTimestampMs === null
                    ? null
                    : (values.endTimestampMs ?? values.startTimestampMs),
                tag: values.tag,
                targets: buildTargetsFromSelection(values),
              }
            : {
                noteType: "TEXT",
                bodyText: values.bodyText ?? "",
                startTimestampMs: values.startTimestampMs,
                tag: values.tag,
                targets: buildTargetsFromSelection(values),
              };

        const response = await fetch(`/api/notes/${editingRow.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = (await response.json()) as UpdateNoteResponse;

        if (!data.ok) {
          throw new Error(data.error.message);
        }
        if (!response.ok) {
          throw new Error("Failed to update note.");
        }

        setEditingRow(null);
        setAudience(null);
        toast.success("Note updated");
        router.refresh();
      } catch (err) {
        setEditError(
          err instanceof Error ? err.message : "Failed to update note."
        );
      }
    });
  };

  const handleDelete = async (row: AuthoredNoteRow) => {
    try {
      const response = await fetch(`/api/notes/${row.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as DeleteNoteResponse;
      if (!data.ok) {
        throw new Error(data.error.message);
      }
      if (!response.ok) {
        throw new Error("Failed to delete note.");
      }
      toast.success("Note deleted");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete note.";
      toast.error(message);
      throw err;
    }
  };

  if (notes.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          You haven&apos;t authored any notes yet. Open a rehearsal to add
          feedback for your team.
        </div>
      </div>
    );
  }

  return (
    <ThreadExpansionProvider>
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
      <AuthorSummaryStrip
        totalAssignments={summary.totalAssignments}
        addressed={summary.addressed}
        stalledCount={summary.stalledCount}
        unassignedCount={summary.unassignedCount}
        repeatingDancerCount={summary.repeatingDancerCount}
        aggregateCounts={summary.aggregate}
        onJumpToStalled={() => setFilter("STALLED")}
      />

      <FilterSortBar
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        counts={filterCounts}
        tagOptions={tagOptions}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
      />

      <div className="flex flex-col gap-2.5">
        {filteredAndSorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No notes match this filter.
          </div>
        ) : (
          filteredAndSorted.map((row) => (
            <AuthoredNoteCard
              key={row.id}
              row={row}
              viewerId={viewerId}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <EditNoteSheet
        open={editingRow !== null && audience !== null}
        onOpenChange={handleEditOpenChange}
        note={editingRow ? toEditableNote(editingRow) : null}
        assignableMembers={audience?.assignableMembers ?? []}
        availableGroups={audience?.availableGroups ?? []}
        isPending={isEditPending || isLoadingAudience}
        errorMessage={editError}
        onSubmit={handleSubmitEdit}
      />
    </div>
    </ThreadExpansionProvider>
  );
}
