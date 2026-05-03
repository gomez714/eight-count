"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RoleChip } from "@/app/teams/[teamId]/role-chip";
import type { TeamRole } from "@/app/teams/[teamId]/role-chip";
import type { ApiResponse } from "@/lib/api/responses";

type AcceptInvitationCardProps = {
  token: string;
  teamName: string;
  role: TeamRole;
  inviterName: string | null;
  inviterEmail: string;
  invitedEmail: string;
  viewerEmail: string;
};

type AcceptResponse = { teamId: string; teamName: string };

export function AcceptInvitationCard({
  token,
  teamName,
  role,
  inviterName,
  inviterEmail,
  invitedEmail,
  viewerEmail,
}: Readonly<AcceptInvitationCardProps>) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inviterDisplay = inviterName?.trim() || inviterEmail;
  const emailMatches =
    invitedEmail.toLowerCase() === viewerEmail.toLowerCase();

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/invitations/${encodeURIComponent(token)}/accept`,
          { method: "POST" }
        );
        const json = (await res.json()) as ApiResponse<AcceptResponse>;
        if (!json.ok) {
          setError(json.error.message);
          return;
        }
        toast.success(`You're in — welcome to ${json.data.teamName}.`);
        router.push(`/teams/${json.data.teamId}`);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const handleSignOutAndRetry = () => {
    void signOut({
      redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`,
    });
  };

  if (!emailMatches) {
    return (
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-7 shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Wrong account
          </span>
          <h1 className="text-xl font-semibold leading-tight tracking-tight">
            This invite is for a different email
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The invitation was sent to{" "}
            <span className="font-medium text-foreground">{invitedEmail}</span>,
            but you&apos;re signed in as{" "}
            <span className="font-medium text-foreground">{viewerEmail}</span>.
            Sign out and back in with the right email to accept.
          </p>
        </div>
        <Button onClick={handleSignOutAndRetry} className="w-full rounded-full">
          Sign out and try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-7 shadow-sm">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Invitation
        </span>
        <h1 className="text-xl font-semibold leading-tight tracking-tight">
          Join {teamName}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{inviterDisplay}</span>{" "}
          invited you to join as a <RoleChip role={role} className="align-middle" />
          . Accept below and you&apos;ll land on the team page.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <Button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full rounded-full"
      >
        {isPending ? "Accepting…" : "Accept invitation"}
      </Button>
    </div>
  );
}
