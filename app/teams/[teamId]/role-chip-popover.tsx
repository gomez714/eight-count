"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  ROLE_INFO,
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
 * Surfaces "what this role sees" and "what this role can do" so users get
 * the visibility/permissions split inline rather than reading a separate doc.
 */
export function RoleChipPopover({
  role,
  size,
  className,
  ariaLabel,
}: Readonly<RoleChipPopoverProps>) {
  const info = ROLE_INFO[role];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `${ROLE_LABEL[role]} — what this role sees and can do`}
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RoleChip role={role} size={size} className={className} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <RoleChip role={role} />
          </div>
          <dl className="flex flex-col gap-2 text-[12.5px] leading-snug">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sees
              </dt>
              <dd className="text-foreground/90">{info.sees}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Can do
              </dt>
              <dd className="text-foreground/90">{info.canDo}</dd>
            </div>
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  );
}
