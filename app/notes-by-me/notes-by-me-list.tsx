"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type NotesByMeListProps = {
  notes: AuthoredNoteRow[];
};

export function NotesByMeList({ notes }: NotesByMeListProps) {
  const [filter, setFilter] = useState<ProgressFilter>("OUTSTANDING");

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
      const hasActive = row.assignments.some((a) => isActiveStatus(a.status));
      if (hasActive) {
        buckets.OUTSTANDING += 1;
      } else {
        buckets.COMPLETE += 1;
      }
    }
    return buckets;
  }, [notes]);

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
            <AuthoredNoteCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
