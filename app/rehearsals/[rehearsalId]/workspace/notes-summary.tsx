import { isActiveStatus } from "@/lib/notes/statuses";

import type { NoteItem } from "./types";

type NotesSummaryProps = {
  notes: NoteItem[];
};

type Counts = {
  total: number;
  unresolved: number;
  resolved: number;
  unassigned: number;
};

function computeCounts(notes: NoteItem[]): Counts {
  let unresolved = 0;
  let resolved = 0;
  let unassigned = 0;

  for (const note of notes) {
    if (note.assignments.length === 0) {
      unassigned += 1;
      continue;
    }

    const hasActive = note.assignments.some((assignment) => {
      const status = assignment.status?.status ?? "OPEN";
      return isActiveStatus(status);
    });

    if (hasActive) {
      unresolved += 1;
    } else {
      resolved += 1;
    }
  }

  return {
    total: notes.length,
    unresolved,
    resolved,
    unassigned,
  };
}

export function NotesSummary({ notes }: NotesSummaryProps) {
  const counts = computeCounts(notes);

  if (counts.total === 0) {
    return null;
  }

  const items: Array<{ label: string; value: number; emphasis?: boolean }> = [
    { label: counts.total === 1 ? "note" : "notes", value: counts.total },
    { label: "unresolved", value: counts.unresolved, emphasis: true },
    { label: "resolved", value: counts.resolved },
    { label: "unassigned", value: counts.unassigned },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
      {items.map((item, index) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5"
          data-emphasis={item.emphasis ? "true" : undefined}
        >
          <span
            className={
              item.emphasis
                ? "font-semibold"
                : "font-medium text-muted-foreground"
            }
          >
            {item.value}
          </span>
          <span className="text-muted-foreground">{item.label}</span>
          {index < items.length - 1 ? (
            <span className="ml-2 text-muted-foreground/60" aria-hidden>
              ·
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
