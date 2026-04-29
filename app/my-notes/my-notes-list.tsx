"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AssignedNoteCard } from "./assigned-note-card";
import {
  DEFAULT_EXPANDED_STATUSES,
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type AssignedNoteRow,
  type NoteStatus,
} from "./types";

type MyNotesListProps = {
  buckets: Record<NoteStatus, AssignedNoteRow[]>;
  totalCount: number;
};

export function MyNotesList({ buckets, totalCount }: MyNotesListProps) {
  const [expanded, setExpanded] = useState<Record<NoteStatus, boolean>>(
    DEFAULT_EXPANDED_STATUSES
  );

  const toggle = (status: NoteStatus) => {
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any notes assigned to you yet. When an
            instructor assigns you feedback, it will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {NOTE_STATUSES.map((status) => {
        const rows = buckets[status];
        const isExpanded = expanded[status];
        const isEmpty = rows.length === 0;

        return (
          <section key={status} className="space-y-3">
            <button
              type="button"
              onClick={() => toggle(status)}
              disabled={isEmpty}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors",
                !isEmpty && "hover:bg-muted/50",
                isEmpty && "cursor-default opacity-60"
              )}
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold">
                  {NOTE_STATUS_LABELS[status]}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {rows.length}
                </span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  isExpanded ? "rotate-180" : "rotate-0",
                  isEmpty && "opacity-0"
                )}
              />
            </button>

            {isExpanded && !isEmpty ? (
              <div className="space-y-3">
                {rows.map((row) => (
                  <AssignedNoteCard key={row.id} row={row} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
