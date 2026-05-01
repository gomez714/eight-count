"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  EditNoteSheet,
  type EditNoteFormValues,
  type EditableNote,
} from "@/components/edit-note-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { isActiveStatus } from "@/lib/notes/statuses";

import { AuthoredNoteCard } from "./authored-note-card";
import type { AuthoredNoteRow } from "./types";

type ProgressFilter = "ALL" | "OUTSTANDING" | "COMPLETE" | "UNASSIGNED";

const FILTER_LABELS: Record<ProgressFilter, string> = {
  ALL: "All",
  OUTSTANDING: "Outstanding",
  COMPLETE: "Complete",
  UNASSIGNED: "Unassigned",
};

const FILTER_ORDER: ProgressFilter[] = [
  "ALL",
  "OUTSTANDING",
  "COMPLETE",
  "UNASSIGNED",
];

function matches(row: AuthoredNoteRow, filter: ProgressFilter): boolean {
  if (filter === "ALL") return true;

  if (filter === "UNASSIGNED") {
    return row.assignments.length === 0;
  }

  if (row.assignments.length === 0) return false;

  const hasActive = row.assignments.some((assignment) =>
    isActiveStatus(assignment.status)
  );

  return filter === "OUTSTANDING" ? hasActive : !hasActive;
}

function toEditableNote(row: AuthoredNoteRow): EditableNote {
  return {
    id: row.id,
    noteType: row.noteType,
    bodyText: row.bodyText,
    startTimestampMs: row.startTimestampMs,
    endTimestampMs: row.endTimestampMs,
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
};

export function NotesByMeList({ notes }: NotesByMeListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<ProgressFilter>("OUTSTANDING");

  const [editingRow, setEditingRow] = useState<AuthoredNoteRow | null>(null);
  const [audience, setAudience] = useState<{
    assignableMembers: AssignableMember[];
    availableGroups: AvailableGroup[];
  } | null>(null);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditPending, startEditTransition] = useTransition();

  const filtered = useMemo(
    () => notes.filter((row) => matches(row, filter)),
    [notes, filter]
  );

  const counts = useMemo(() => {
    const buckets = {
      ALL: notes.length,
      OUTSTANDING: 0,
      COMPLETE: 0,
      UNASSIGNED: 0,
    } as Record<ProgressFilter, number>;
    for (const row of notes) {
      if (row.assignments.length === 0) {
        buckets.UNASSIGNED += 1;
        continue;
      }
      const hasActive = row.assignments.some((a) =>
        isActiveStatus(a.status)
      );
      if (hasActive) {
        buckets.OUTSTANDING += 1;
      } else {
        buckets.COMPLETE += 1;
      }
    }
    return buckets;
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

        const requestBody: UpdateNoteRequest =
          editingRow.noteType === "VOICE"
            ? {
                noteType: "VOICE",
                startTimestampMs: values.startTimestampMs,
                endTimestampMs:
                  values.endTimestampMs ?? values.startTimestampMs,
                targets: buildTargetsFromSelection(values),
              }
            : {
                noteType: "TEXT",
                bodyText: values.bodyText ?? "",
                startTimestampMs: values.startTimestampMs,
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t authored any notes yet. Open a rehearsal to add
            feedback for your team.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as ProgressFilter)}
        >
          <SelectTrigger size="sm" aria-label="Filter notes">
            <SelectValue>
              {FILTER_LABELS[filter]} ({counts[filter]})
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FILTER_ORDER.map((option) => (
              <SelectItem key={option} value={option}>
                {FILTER_LABELS[option]} ({counts[option]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filter !== "ALL" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilter("ALL")}
          >
            Clear filter
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No notes match this filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <AuthoredNoteCard
              key={row.id}
              row={row}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

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
  );
}
