"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  RoleChip,
  type TeamRole,
} from "./role-chip";

type RoleChipPopoverProps = {
  role: TeamRole;
  size?: "sm" | "md";
  className?: string;
  /** Optional override for the popover trigger's aria-label. */
  ariaLabel?: string;
};

/**
 * RoleChip wrapped in a popover that explains the role.
 * Replaces the persistent role glossary by surfacing context where it's asked.
 */
export function RoleChipPopover({
  role,
  size,
  className,
  ariaLabel,
}: Readonly<RoleChipPopoverProps>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `${ROLE_LABEL[role]} — what this role can do`}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RoleChip role={role} size={size} className={className} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-64 p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <RoleChip role={role} />
          </div>
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            {ROLE_DESCRIPTION[role]}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
