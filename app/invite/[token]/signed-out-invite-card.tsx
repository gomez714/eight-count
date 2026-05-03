import Link from "next/link";

import { Button } from "@/components/ui/button";
import { RoleChip } from "@/app/teams/[teamId]/role-chip";
import type { TeamRole } from "@/app/teams/[teamId]/role-chip";

type SignedOutInviteCardProps = {
  teamName: string;
  role: TeamRole;
  inviterName: string | null;
  inviterEmail: string;
  invitedEmail: string;
  token: string;
};

export function SignedOutInviteCard({
  teamName,
  role,
  inviterName,
  inviterEmail,
  invitedEmail,
  token,
}: Readonly<SignedOutInviteCardProps>) {
  const inviterDisplay = inviterName?.trim() || inviterEmail;
  const redirectUrl = `/invite/${encodeURIComponent(token)}`;
  const signUpHref = `/sign-up?email=${encodeURIComponent(invitedEmail)}&redirect_url=${encodeURIComponent(redirectUrl)}`;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-7 shadow-sm">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Invitation
        </span>
        <h1 className="text-xl font-semibold leading-tight tracking-tight">
          You&apos;re invited to {teamName}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{inviterDisplay}</span>{" "}
          invited <span className="font-medium text-foreground">{invitedEmail}</span> to join as a{" "}
          <RoleChip role={role} className="align-middle" />.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Create an account to accept. Already have one? Sign in with{" "}
        <span className="font-medium text-foreground">{invitedEmail}</span>.
      </div>

      <div className="flex flex-col gap-2">
        <Button asChild className="w-full rounded-full">
          <Link href={signUpHref}>Create account</Link>
        </Button>
        <Button asChild variant="outline" className="w-full rounded-full">
          <Link href={signInHref}>I already have an account</Link>
        </Button>
      </div>
    </div>
  );
}
