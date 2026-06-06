"use client";

import { ChevronDown, Users as UsersIcon, UserSquare2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { DrillRow } from "@/components/drill/drill-row";
import { DrillTagSection } from "@/components/drill/drill-tag-section";
import { ExpandableRepeatingChip } from "@/components/expandable-repeating-chip";
import { RepeatingClusterExpansionProvider } from "@/components/repeating-cluster-expansion-context";
import { TagChip } from "@/components/tag-chip";
import { sortByDrillPriority } from "@/lib/notes/drill-sort";
import type { RepeatingClusterDetail } from "@/lib/notes/repeating";
import type { NoteStatus } from "@/lib/notes/statuses";
import { NOTE_TAG_LABELS, NOTE_TAGS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

export type DrillItem = {
  assignmentId: string;
  noteId: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  voiceTranscript: string | null;
  audioDurationMs: number | null;
  /**
   * Null when the note has no video anchor — the drill row renders a
   * relative-date label (from `createdAtMs`) in place of `mm:ss`. The
   * project-drill priority sort already keys off `createdAtMs` /
   * `rehearsalDateMs`, so null timestamps don't change ordering.
   */
  startTimestampMs: number | null;
  status: NoteStatus;
  rehearsalId: string;
  rehearsalTitle: string;
  // Priority-sort signals. Numbers (not Dates) so the shape survives
  // the server→client serialization boundary cleanly. See drill-sort.ts.
  createdAtMs: number;
  rehearsalDateMs: number;
  isRepeating: boolean;
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

type GroupingMode = "dancer" | "tag";

type ProjectDrillSectionProps = {
  recipients: DrillBoardRecipient[];
  /** Default-expanded user, typically the current viewer when present. */
  initialExpandedUserId: string | null;
  /**
   * Expandable repeating-cluster details for every cluster in the
   * project. Keyed by `${userId}-${tag}` so each tag section header
   * inside a recipient's panel can find its detail in O(1).
   */
  clusterDetails: RepeatingClusterDetail[];
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

// ----------------------------------------------------------------------------
// By-tag transpose
// ----------------------------------------------------------------------------

type ByTagDancer = {
  userId: string;
  userName: string | null;
  userEmail: string;
  items: DrillItem[];
  isRepeating: boolean;
  repeatingCount: number;
};

type ByTagGroup = {
  tag: NoteTag | null;
  totalItems: number;
  dancers: ByTagDancer[];
  /** Number of dancers in this group who have a repeating cluster on this tag. */
  repeatingDancerCount: number;
};

function buildTagGroups(recipients: DrillBoardRecipient[]): ByTagGroup[] {
  const groupsByTag = new Map<NoteTag | "OTHER", ByTagGroup>();

  for (const recipient of recipients) {
    for (const bucket of recipient.buckets) {
      const key: NoteTag | "OTHER" = bucket.tag ?? "OTHER";
      let group = groupsByTag.get(key);
      if (!group) {
        group = {
          tag: bucket.tag,
          totalItems: 0,
          dancers: [],
          repeatingDancerCount: 0,
        };
        groupsByTag.set(key, group);
      }
      group.dancers.push({
        userId: recipient.userId,
        userName: recipient.userName,
        userEmail: recipient.userEmail,
        items: bucket.items,
        isRepeating: bucket.isRepeating,
        repeatingCount: bucket.repeatingCount,
      });
      group.totalItems += bucket.items.length;
      if (bucket.isRepeating) group.repeatingDancerCount += 1;
    }
  }

  // Sort dancers within each group: repeating first → more items first → name.
  for (const group of groupsByTag.values()) {
    group.dancers.sort(compareByTagDancers);
  }

  // Sort the groups themselves: canonical tag order, untagged last.
  return [...TAG_ORDER]
    .map((tag) => groupsByTag.get(tag ?? "OTHER"))
    .filter((g): g is ByTagGroup => g !== undefined);
}

function compareByTagDancers(a: ByTagDancer, b: ByTagDancer): number {
  if (a.isRepeating !== b.isRepeating) return a.isRepeating ? -1 : 1;
  if (a.items.length !== b.items.length) return b.items.length - a.items.length;
  const aName = (a.userName || a.userEmail).toLowerCase();
  const bName = (b.userName || b.userEmail).toLowerCase();
  return aName.localeCompare(bName);
}

// ----------------------------------------------------------------------------
// Section orchestrator
// ----------------------------------------------------------------------------

export function ProjectDrillSection({
  recipients,
  initialExpandedUserId,
  clusterDetails,
}: Readonly<ProjectDrillSectionProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groupingMode: GroupingMode =
    searchParams.get("groupBy") === "tag" ? "tag" : "dancer";

  // Per-mode expansion state. Dancer keys are userIds; tag keys are tag
  // names (or "OTHER"). Two maps avoid any accidental collision and let
  // expand-all behave correctly per mode without bookkeeping.
  const [dancerExpanded, setDancerExpanded] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      if (initialExpandedUserId) initial[initialExpandedUserId] = true;
      return initial;
    },
  );
  const [tagExpanded, setTagExpanded] = useState<Record<string, boolean>>({});

  // `${userId}-${tag}` → cluster detail lookup. Used by chips in both
  // grouping modes (dancer mode reads inside per-dancer DrillTagSection,
  // tag mode reads inside per-dancer subsection of a tag card).
  const detailByKey = useMemo(
    () => new Map(clusterDetails.map((d) => [d.key, d] as const)),
    [clusterDetails],
  );

  const tagGroups = useMemo(() => buildTagGroups(recipients), [recipients]);

  const setGroupingMode = (next: GroupingMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "tag") {
      params.set("groupBy", "tag");
    } else {
      params.delete("groupBy");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  if (recipients.length === 0) return null;

  return (
    <RepeatingClusterExpansionProvider>
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
        <header className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Drill board</h2>
          <span className="text-xs text-muted-foreground">
            {groupingMode === "dancer"
              ? "All open + in-progress notes, grouped by dancer and tag."
              : "All open + in-progress notes, grouped by tag — useful for planning sectionals."}
          </span>
          <div className="ml-auto inline-flex items-center gap-2">
            <GroupingToggle mode={groupingMode} onChange={setGroupingMode} />
            {groupingMode === "dancer" ? (
              <ExpandAllButton
                expanded={dancerExpanded}
                items={recipients.map((r) => r.userId)}
                setExpanded={setDancerExpanded}
              />
            ) : (
              <ExpandAllButton
                expanded={tagExpanded}
                items={tagGroups.map((g) => g.tag ?? "OTHER")}
                setExpanded={setTagExpanded}
              />
            )}
          </div>
        </header>

        {groupingMode === "dancer" ? (
          <DancerGroupedView
            recipients={recipients}
            expanded={dancerExpanded}
            setExpanded={setDancerExpanded}
            detailByKey={detailByKey}
          />
        ) : (
          <TagGroupedView
            groups={tagGroups}
            expanded={tagExpanded}
            setExpanded={setTagExpanded}
            detailByKey={detailByKey}
          />
        )}
      </section>
    </RepeatingClusterExpansionProvider>
  );
}

// ----------------------------------------------------------------------------
// Header controls
// ----------------------------------------------------------------------------

function GroupingToggle({
  mode,
  onChange,
}: Readonly<{ mode: GroupingMode; onChange: (next: GroupingMode) => void }>) {
  return (
    <div
      role="tablist"
      aria-label="Group drills by"
      className="inline-flex gap-0.5 rounded-md border border-border bg-muted p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "dancer"}
        onClick={() => onChange("dancer")}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-2 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          mode === "dancer"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <UserSquare2 aria-hidden className="size-3.5" />
        By dancer
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "tag"}
        onClick={() => onChange("tag")}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-2 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          mode === "tag"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <UsersIcon aria-hidden className="size-3.5" />
        By tag
      </button>
    </div>
  );
}

function ExpandAllButton({
  expanded,
  items,
  setExpanded,
}: Readonly<{
  expanded: Record<string, boolean>;
  items: string[];
  setExpanded: (next: Record<string, boolean>) => void;
}>) {
  const allExpanded = items.length > 0 && items.every((id) => expanded[id]);
  return (
    <button
      type="button"
      onClick={() =>
        setExpanded(
          allExpanded
            ? {}
            : Object.fromEntries(items.map((id) => [id, true])),
        )
      }
      className="rounded text-xs font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {allExpanded ? "Collapse all" : "Expand all"}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Dancer-grouped view (the original layout, extracted)
// ----------------------------------------------------------------------------

type DancerGroupedViewProps = {
  recipients: DrillBoardRecipient[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  detailByKey: Map<string, RepeatingClusterDetail>;
};

function DancerGroupedView({
  recipients,
  expanded,
  setExpanded,
  detailByKey,
}: Readonly<DancerGroupedViewProps>) {
  const toggle = (userId: string) =>
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  return (
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
                {sortedBuckets.map((bucket) => {
                  // Repeating first → oldest unresolved → newest rehearsal →
                  // id. See `lib/notes/drill-sort.ts`.
                  const sortedItems = sortByDrillPriority(
                    bucket.items,
                    (item) => ({
                      isRepeating: item.isRepeating,
                      createdAtMs: item.createdAtMs,
                      rehearsalDateMs: item.rehearsalDateMs,
                      tiebreaker: item.assignmentId,
                    }),
                  );
                  const repeatingDetail = bucket.tag
                    ? detailByKey.get(
                        `${recipient.userId}-${bucket.tag}`,
                      )
                    : undefined;
                  return (
                    <DrillTagSection
                      key={bucket.tag ?? "OTHER"}
                      tag={bucket.tag}
                      itemCount={bucket.items.length}
                      repeatingCount={
                        bucket.isRepeating
                          ? bucket.repeatingCount
                          : undefined
                      }
                      repeatingDetail={repeatingDetail}
                      variant="inline"
                    >
                      {sortedItems.map((item) => (
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
                            createdAt: new Date(item.createdAtMs),
                            status: item.status,
                          }}
                        />
                      ))}
                    </DrillTagSection>
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Tag-grouped view (new — the sectional-planning lens)
// ----------------------------------------------------------------------------

type TagGroupedViewProps = {
  groups: ByTagGroup[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  detailByKey: Map<string, RepeatingClusterDetail>;
};

function TagGroupedView({
  groups,
  expanded,
  setExpanded,
  detailByKey,
}: Readonly<TagGroupedViewProps>) {
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ul className="flex flex-col gap-1.5">
      {groups.map((group) => {
        const key = group.tag ?? "OTHER";
        const isOpen = !!expanded[key];
        return (
          <li
            key={key}
            className="overflow-hidden rounded-md border"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {group.tag ? (
                  <>
                    <TagChip tag={group.tag} size="sm" />
                    <span className="text-sm font-semibold">
                      {NOTE_TAG_LABELS[group.tag]}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Other (untagged)
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {group.totalItems}{" "}
                  {group.totalItems === 1 ? "active note" : "active notes"} ·{" "}
                  {group.dancers.length}{" "}
                  {group.dancers.length === 1 ? "dancer" : "dancers"}
                  {group.repeatingDancerCount > 0
                    ? ` · ${group.repeatingDancerCount} repeating`
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
              <div className="flex flex-col divide-y border-t bg-background/50">
                {group.dancers.map((dancer) => {
                  const repeatingDetail = group.tag
                    ? detailByKey.get(`${dancer.userId}-${group.tag}`)
                    : undefined;
                  return (
                    <DancerInTagSection
                      key={dancer.userId}
                      dancer={dancer}
                      repeatingDetail={repeatingDetail}
                    />
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DancerInTagSection({
  dancer,
  repeatingDetail,
}: Readonly<{
  dancer: ByTagDancer;
  repeatingDetail: RepeatingClusterDetail | undefined;
}>) {
  // Repeating first → oldest unresolved → newest rehearsal → id.
  const sortedItems = sortByDrillPriority(dancer.items, (item) => ({
    isRepeating: item.isRepeating,
    createdAtMs: item.createdAtMs,
    rehearsalDateMs: item.rehearsalDateMs,
    tiebreaker: item.assignmentId,
  }));
  const displayName = dancer.userName || dancer.userEmail;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <AvatarInitials
          name={dancer.userName}
          fallback={dancer.userEmail}
          toneSeed={dancer.userId}
          size={22}
        />
        <span className="text-sm font-semibold">{displayName}</span>
        <span className="text-[11px] text-muted-foreground">
          {dancer.items.length}{" "}
          {dancer.items.length === 1 ? "note" : "notes"}
        </span>
        {/* Detail is always present in practice when `dancer.isRepeating`
            is true (both derive from the same `projectClusters` set). If
            the two ever drift, render nothing rather than a malformed
            chip — the dancer's items are still visible below. */}
        {dancer.isRepeating && repeatingDetail ? (
          <ExpandableRepeatingChip detail={repeatingDetail} compact />
        ) : null}
      </div>
      <ul className="flex flex-col gap-1.5">
        {sortedItems.map((item) => (
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
              createdAt: new Date(item.createdAtMs),
              status: item.status,
            }}
          />
        ))}
      </ul>
    </div>
  );
}
