import type { CSSProperties } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { StatusDot } from "@/app/rehearsals/[rehearsalId]/workspace/status-chip";
import { NOTE_STATUS_LABELS, type NoteStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import type { AuthoredNoteAssignment } from "./types";

const STATUS_FG: Record<NoteStatus, string> = {
  OPEN: "var(--status-open-fg)",
  IN_PROGRESS: "var(--status-progress-fg)",
  ADDRESSED: "var(--status-addressed-fg)",
  RESOLVED: "var(--status-resolved-fg)",
};

const SHORT_STATUS_LABEL: Record<NoteStatus, string> = {
  OPEN: NOTE_STATUS_LABELS.OPEN,
  IN_PROGRESS: "Working",
  ADDRESSED: NOTE_STATUS_LABELS.ADDRESSED,
  RESOLVED: NOTE_STATUS_LABELS.RESOLVED,
};

type RecipientPipRowProps = {
  assignments: AuthoredNoteAssignment[];
  /** When true, OPEN pips are highlighted with the in-progress tint. */
  stalled: boolean;
  className?: string;
};

export function RecipientPipRow({
  assignments,
  stalled,
  className,
}: Readonly<RecipientPipRowProps>) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {assignments.map((a) => {
        const isOpenStalled = stalled && a.status === "OPEN";
        const pipStyle: CSSProperties = isOpenStalled
          ? {
              backgroundColor: "var(--status-progress-bg)",
              borderColor: "var(--status-progress-border)",
            }
          : {};
        const statusColor = STATUS_FG[a.status];
        const displayName = a.user.name || a.user.email;

        return (
          <span
            key={a.id}
            data-status={a.status}
            data-stalled={isOpenStalled || undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 text-[11px]",
              !isOpenStalled && "border-border bg-muted/50"
            )}
            style={pipStyle}
          >
            <AvatarInitials
              name={a.user.name}
              fallback={a.user.email}
              toneSeed={a.user.id}
              size={18}
            />
            <span className="font-medium text-foreground">{displayName}</span>
            <StatusDot status={a.status} />
            <span
              className="text-[10.5px] font-semibold"
              style={{ color: statusColor }}
            >
              {SHORT_STATUS_LABEL[a.status]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
