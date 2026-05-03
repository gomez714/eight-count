"use client";

import { Copy, MailCheck, MoreHorizontal, RotateCw, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useTransition } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { resendInvitation, revokeInvitation } from "./member-actions";
import { RoleChip, type TeamRole } from "./role-chip";

export type PendingInvitationRowData = {
  invitationId: string;
  email: string;
  role: TeamRole;
  invitedAt: Date;
  expiresAt: Date;
};

type PendingInvitationRowProps = {
  teamId: string;
  invitation: PendingInvitationRowData;
  isLast: boolean;
  canManage: boolean;
};

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function PendingInvitationRow({
  teamId,
  invitation,
  isLast,
  canManage,
}: Readonly<PendingInvitationRowProps>) {
  const [isPending, startTransition] = useTransition();

  const rowStyle: CSSProperties = {
    borderBottomWidth: isLast ? 0 : 1,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.email);
      toast.success("Email copied to clipboard.");
    } catch {
      toast.error("Couldn't copy email.");
    }
  };

  const handleResend = () => {
    startTransition(async () => {
      const result = await resendInvitation({
        teamId,
        invitationId: invitation.invitationId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Invitation resent to ${invitation.email}.`);
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeInvitation({
        teamId,
        invitationId: invitation.invitationId,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invitation revoked.");
    });
  };

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted/20 px-3 py-2.5 opacity-90 sm:grid-cols-[auto_minmax(0,1fr)_120px_130px_auto] sm:gap-4 sm:px-4 sm:py-3"
      style={rowStyle}
      data-pending-invitation
    >
      <AvatarInitials
        name={null}
        fallback={invitation.email}
        toneSeed={invitation.email}
        size={32}
      />

      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold leading-tight text-foreground">
            {invitation.email}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: "var(--status-progress-bg)",
              color: "var(--status-progress-fg)",
              borderColor: "var(--status-progress-border)",
            }}
          >
            <MailCheck aria-hidden className="size-2.5" />
            Pending
          </span>
        </div>
        <span className="truncate text-[12px] leading-snug text-muted-foreground">
          Invited {formatRelative(invitation.invitedAt)}
        </span>
      </div>

      {/* Desktop role column */}
      <span className="hidden sm:inline-flex">
        <RoleChip role={invitation.role} />
      </span>

      {/* Right cluster — mobile shows role, desktop shows expiry */}
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex sm:hidden">
          <RoleChip role={invitation.role} />
        </span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Expires {formatRelative(invitation.expiresAt).replace(" ago", "")}
        </span>
      </div>

      <div className="flex items-center justify-end">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Invitation actions"
                disabled={isPending}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onSelect={handleResend} disabled={isPending}>
                <RotateCw aria-hidden className="size-3.5" />
                Resend invite
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopy}>
                <Copy aria-hidden className="size-3.5" />
                Copy email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleRevoke} disabled={isPending}>
                <X aria-hidden className="size-3.5" />
                Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span aria-hidden className="inline-block size-6" />
        )}
      </div>
    </div>
  );
}
