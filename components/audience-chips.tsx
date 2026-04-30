import { cn } from "@/lib/utils";

export type AudienceChipsTarget = {
  id: string;
  kind: "EVERYONE" | "GROUP" | "USER";
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  group: { id: string; name: string } | null;
};

type AudienceChipsProps = {
  targets: AudienceChipsTarget[];
  /**
   * Optional fallback to render when there are no targets (e.g. "Unassigned").
   * Defaults to a dashed "Unassigned" pill.
   */
  emptyLabel?: string;
  className?: string;
};

function renderLabel(target: AudienceChipsTarget): string {
  if (target.kind === "EVERYONE") return "Full cast";
  if (target.kind === "GROUP") return target.group?.name ?? "Group";
  return target.user?.name ?? target.user?.email ?? "Member";
}

function targetStyle(kind: AudienceChipsTarget["kind"]): string {
  if (kind === "EVERYONE") {
    return "bg-foreground text-background";
  }
  if (kind === "GROUP") {
    return "bg-primary/10 text-primary border border-primary/20";
  }
  return "border border-border text-muted-foreground";
}

export function AudienceChips({
  targets,
  emptyLabel = "Unassigned",
  className,
}: AudienceChipsProps) {
  if (targets.length === 0) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
          {emptyLabel}
        </span>
      </div>
    );
  }

  // Render EVERYONE first (it subsumes everything else conceptually), then
  // groups, then individual users.
  const sorted = [...targets].sort((a, b) => {
    const order = { EVERYONE: 0, GROUP: 1, USER: 2 } as const;
    return order[a.kind] - order[b.kind];
  });

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sorted.map((target) => (
        <span
          key={target.id}
          data-kind={target.kind}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            targetStyle(target.kind)
          )}
        >
          <span className="truncate">{renderLabel(target)}</span>
        </span>
      ))}
    </div>
  );
}
