"use client";

import { Copy, MoreHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { RoleChipPopover } from "./role-chip-popover";
import { type TeamRole } from "./role-chip";

export type MemberRowData = {
  teamMemberId: string;
  userId: string;
  name: string | null;
  email: string;
  role: TeamRole;
  joinedAt: Date;
  isYou: boolean;
};

type MemberRowProps = {
  member: MemberRowData;
  isLast: boolean;
  /**
   * When true and the row is not the viewer's own, render the admin overflow menu.
   * Currently exposes "Copy email"; future actions (change role, remove) slot
   * in here without redesigning the row.
   */
  canManage: boolean;
};

function formatJoinDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function MemberActionsMenu({ email }: Readonly<{ email: string }>) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard.");
    } catch {
      toast.error("Couldn't copy email.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Member actions"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onSelect={handleCopy}>
          <Copy aria-hidden className="size-3.5" />
          Copy email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MemberRow({ member, isLast, canManage }: Readonly<MemberRowProps>) {
  const rowStyle: CSSProperties = {
    borderBottomWidth: isLast ? 0 : 1,
  };

  const showActions = canManage && !member.isYou;

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_120px_130px_auto] sm:gap-4 sm:px-4 sm:py-3"
      style={rowStyle}
    >
      <AvatarInitials
        name={member.name}
        fallback={member.email}
        toneSeed={member.userId}
        size={32}
      />

      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
            {member.name || member.email}
          </span>
          {member.isYou ? (
            <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              You
            </span>
          ) : null}
        </div>
        <span className="truncate text-[12px] leading-snug text-muted-foreground">
          {member.email}
        </span>
      </div>

      {/* Desktop: dedicated role column. */}
      <span className="hidden sm:inline-flex">
        <RoleChipPopover role={member.role} />
      </span>

      {/* Right cluster.
          Mobile: role chip (and overflow appears in the dedicated overflow cell below).
          Desktop: joined date stacked at right, with overflow in its own column. */}
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex sm:hidden">
          <RoleChipPopover role={member.role} />
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Joined {formatJoinDate(member.joinedAt)}
        </span>
      </div>

      {/* Overflow cell — present on all sizes; reserves space (size-6) when not actionable
          so rows align consistently regardless of which row owns the menu. */}
      <div className="flex items-center justify-end">
        {showActions ? (
          <MemberActionsMenu email={member.email} />
        ) : (
          <span aria-hidden className="inline-block size-6" />
        )}
      </div>
    </div>
  );
}
