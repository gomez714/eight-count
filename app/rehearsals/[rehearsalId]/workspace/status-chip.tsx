import {
  NOTE_STATUS_LABELS,
  isActiveStatus,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

type StatusChipProps = {
  status: NoteStatus;
  label: string;
};

export function StatusChip({ status, label }: StatusChipProps) {
  const isActive = isActiveStatus(status);

  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        isActive
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground"
      )}
    >
      <span className="truncate">{label}</span>
      <span className="opacity-70">·</span>
      <span className="font-medium">{NOTE_STATUS_LABELS[status]}</span>
    </span>
  );
}
