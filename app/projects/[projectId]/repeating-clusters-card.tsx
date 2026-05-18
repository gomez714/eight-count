"use client";

import { ChevronDown, Repeat } from "lucide-react";
import { useMemo } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { RepeatingClusterDetails } from "@/components/repeating-cluster-details";
import {
  RepeatingClusterExpansionProvider,
  useRepeatingClusterExpansion,
} from "@/components/repeating-cluster-expansion-context";
import { TagChip } from "@/components/tag-chip";
import type { RepeatingClusterDetail } from "@/lib/notes/repeating";
import type { NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

export type RepeatingClusterSummary = {
  userId: string;
  userName: string | null;
  userEmail: string;
  tag: NoteTag;
  count: number;
};

type RepeatingClustersCardProps = {
  clusters: RepeatingClusterSummary[];
  /**
   * One entry per cluster, keyed `${userId}-${tag}`. When a row's
   * matching detail is present, the row becomes expandable and reveals
   * an inline `RepeatingClusterDetails` panel. Rows without a matching
   * detail (shouldn't happen in practice — both are derived from the
   * same `projectClusters` set) stay non-interactive.
   */
  clusterDetails: RepeatingClusterDetail[];
};

export function RepeatingClustersCard({
  clusters,
  clusterDetails,
}: Readonly<RepeatingClustersCardProps>) {
  // `${userId}-${tag}` → detail lookup for the row-level expansion.
  // Memoized so the Map identity is stable across renders that don't
  // touch the cluster details — matches the pattern in
  // `project-drill-section.tsx`.
  const detailByKey = useMemo(
    () => new Map(clusterDetails.map((d) => [d.key, d] as const)),
    [clusterDetails],
  );

  if (clusters.length === 0) return null;

  return (
    <RepeatingClusterExpansionProvider>
      <section
        className="flex flex-col gap-3 rounded-lg border p-4"
        style={{
          backgroundColor: "var(--repeating-bg)",
          borderColor: "var(--repeating-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Repeat
            aria-hidden
            className="size-4"
            style={{ color: "var(--repeating-fg)" }}
          />
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--repeating-fg)" }}
          >
            Repeating corrections
          </h2>
          <span className="text-xs text-muted-foreground">
            {clusters.length === 1
              ? "1 dancer keeps getting the same kind of note"
              : `${clusters.length} dancers keep getting the same kind of note`}
          </span>
        </div>

        <ul className="flex flex-col gap-1.5">
          {clusters.map((cluster) => (
            <RepeatingClusterRow
              key={`${cluster.userId}-${cluster.tag}`}
              cluster={cluster}
              detail={detailByKey.get(`${cluster.userId}-${cluster.tag}`)}
            />
          ))}
        </ul>
      </section>
    </RepeatingClusterExpansionProvider>
  );
}

function RepeatingClusterRow({
  cluster,
  detail,
}: Readonly<{
  cluster: RepeatingClusterSummary;
  detail: RepeatingClusterDetail | undefined;
}>) {
  const coordinator = useRepeatingClusterExpansion();
  // Coordinator should always be present (we mount it above), but guard
  // for the edge case where someone renders the row standalone.
  const key = `${cluster.userId}-${cluster.tag}`;
  const isExpanded = coordinator?.isExpanded(key) ?? false;
  const canExpand = !!detail && !!coordinator;

  const displayName = cluster.userName || cluster.userEmail;

  return (
    <li className="overflow-hidden rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2">
        <AvatarInitials
          name={cluster.userName}
          fallback={cluster.userEmail}
          toneSeed={cluster.userId}
          size={22}
        />
        <span className="text-sm font-medium">{displayName}</span>
        <TagChip tag={cluster.tag} />
        {canExpand ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Hide repeating-cluster details for ${displayName}`
                : `Show repeating-cluster details for ${displayName}`
            }
            onClick={() => coordinator.setExpanded(key, !isExpanded)}
            className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            style={{ color: "var(--repeating-fg)" }}
          >
            {cluster.count} unresolved
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3 transition-transform",
                isExpanded ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
        ) : (
          <span
            className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground"
          >
            {cluster.count} unresolved
          </span>
        )}
      </div>
      {canExpand && detail && isExpanded ? (
        <div className="border-t px-3 pt-2 pb-3">
          <RepeatingClusterDetails detail={detail} />
        </div>
      ) : null}
    </li>
  );
}
