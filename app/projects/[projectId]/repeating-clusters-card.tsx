import { Repeat } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { TagChip } from "@/components/tag-chip";
import type { NoteTag } from "@/lib/notes/tags";

export type RepeatingClusterSummary = {
  userId: string;
  userName: string | null;
  userEmail: string;
  tag: NoteTag;
  count: number;
};

type RepeatingClustersCardProps = {
  clusters: RepeatingClusterSummary[];
};

export function RepeatingClustersCard({
  clusters,
}: Readonly<RepeatingClustersCardProps>) {
  if (clusters.length === 0) return null;

  return (
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
        {clusters.map((cluster) => {
          const displayName = cluster.userName || cluster.userEmail;
          return (
            <li
              key={`${cluster.userId}-${cluster.tag}`}
              className="flex flex-wrap items-center gap-2.5 rounded-md border bg-card px-3 py-2"
            >
              <AvatarInitials
                name={cluster.userName}
                fallback={cluster.userEmail}
                toneSeed={cluster.userId}
                size={22}
              />
              <span className="text-sm font-medium">{displayName}</span>
              <TagChip tag={cluster.tag} />
              <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
                {cluster.count} unresolved
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
