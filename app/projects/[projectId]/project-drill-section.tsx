"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { DrillRow } from "@/components/drill/drill-row";
import { DrillTagSection } from "@/components/drill/drill-tag-section";
import type { NoteStatus } from "@/lib/notes/statuses";
import { NOTE_TAGS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

export type DrillItem = {
  assignmentId: string;
  noteId: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  voiceTranscript: string | null;
  audioDurationMs: number | null;
  startTimestampMs: number;
  status: NoteStatus;
  rehearsalId: string;
  rehearsalTitle: string;
};

export type DrillTagBucket = {
  tag: NoteTag | null;
  items: DrillItem[];
  isRepeating: boolean;
  repeatingCount: number;
};

export type DrillBoardRecipient = {
  userId: string;
  userName: string | null;
  userEmail: string;
  buckets: DrillTagBucket[];
  totalItems: number;
  repeatingClusterCount: number;
};

type ProjectDrillSectionProps = {
  recipients: DrillBoardRecipient[];
  /** Default-expanded user, typically the current viewer when present. */
  initialExpandedUserId: string | null;
};

const TAG_ORDER: ReadonlyArray<NoteTag | null> = [...NOTE_TAGS, null];

function sortBuckets(a: DrillTagBucket, b: DrillTagBucket): number {
  // Repeating clusters first, then by descending count, then in canonical
  // tag order, with untagged ("Other") always last.
  if (a.isRepeating !== b.isRepeating) return a.isRepeating ? -1 : 1;
  if (a.items.length !== b.items.length) return b.items.length - a.items.length;
  const ai = TAG_ORDER.indexOf(a.tag);
  const bi = TAG_ORDER.indexOf(b.tag);
  return ai - bi;
}

export function ProjectDrillSection({
  recipients,
  initialExpandedUserId,
}: Readonly<ProjectDrillSectionProps>) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (initialExpandedUserId) initial[initialExpandedUserId] = true;
    return initial;
  });

  const toggle = (userId: string) =>
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const expandAll = () =>
    setExpanded(
      Object.fromEntries(recipients.map((r) => [r.userId, true])),
    );
  const collapseAll = () => setExpanded({});

  const allExpanded = useMemo(
    () => recipients.every((r) => expanded[r.userId]),
    [recipients, expanded],
  );

  if (recipients.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Drill board</h2>
        <span className="text-xs text-muted-foreground">
          All open + in-progress notes, grouped by dancer and tag.
        </span>
        <button
          type="button"
          onClick={allExpanded ? collapseAll : expandAll}
          className="ml-auto text-xs font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </header>

      <ul className="flex flex-col gap-1.5">
        {recipients.map((recipient) => {
          const isOpen = !!expanded[recipient.userId];
          const sortedBuckets = [...recipient.buckets].sort(sortBuckets);
          const displayName = recipient.userName || recipient.userEmail;

          return (
            <li
              key={recipient.userId}
              className="overflow-hidden rounded-md border"
            >
              <button
                type="button"
                onClick={() => toggle(recipient.userId)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AvatarInitials
                  name={recipient.userName}
                  fallback={recipient.userEmail}
                  toneSeed={recipient.userId}
                  size={26}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {recipient.totalItems}{" "}
                    {recipient.totalItems === 1 ? "open note" : "open notes"} ·{" "}
                    {recipient.buckets.length}{" "}
                    {recipient.buckets.length === 1 ? "tag" : "tags"}
                    {recipient.repeatingClusterCount > 0
                      ? ` · ${recipient.repeatingClusterCount} repeating`
                      : ""}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>

              {isOpen ? (
                <div className="flex flex-col gap-3 border-t bg-background/50 px-3 py-3">
                  {sortedBuckets.map((bucket) => (
                    <DrillTagSection
                      key={bucket.tag ?? "OTHER"}
                      tag={bucket.tag}
                      itemCount={bucket.items.length}
                      repeatingCount={
                        bucket.isRepeating ? bucket.repeatingCount : undefined
                      }
                      variant="inline"
                    >
                      {bucket.items.map((item) => (
                        <DrillRow
                          key={item.assignmentId}
                          item={{
                            rehearsalId: item.rehearsalId,
                            rehearsalTitle: item.rehearsalTitle,
                            noteType: item.noteType,
                            bodyText: item.bodyText,
                            voiceTranscript: item.voiceTranscript,
                            audioDurationMs: item.audioDurationMs,
                            startTimestampMs: item.startTimestampMs,
                            status: item.status,
                          }}
                        />
                      ))}
                    </DrillTagSection>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
