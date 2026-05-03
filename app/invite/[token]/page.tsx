import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";
import { lookupInvitationByToken } from "@/lib/invitations/lookup";

import { AcceptInvitationCard } from "./accept-invitation-card";
import { SignedOutInviteCard } from "./signed-out-invite-card";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Readonly<InvitePageProps>) {
  const { token } = await params;
  const [lookup, viewer] = await Promise.all([
    lookupInvitationByToken(token),
    getCurrentDbUser(),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mb-8 sm:mb-10">
        <BrandLockup size="lg" showCountDots />
      </div>

      <div className="w-full max-w-md">{renderState(lookup, viewer, token)}</div>
    </div>
  );
}

function renderState(
  lookup: Awaited<ReturnType<typeof lookupInvitationByToken>>,
  viewer: Awaited<ReturnType<typeof getCurrentDbUser>>,
  token: string
) {
  if (lookup.kind === "not_found") {
    return (
      <InfoCard
        title="Invitation not found"
        description="This link is invalid or has been deleted. Ask whoever invited you to send a new one."
        ctaHref={viewer ? "/dashboard" : "/"}
        ctaLabel={viewer ? "Back to dashboard" : "Back to home"}
      />
    );
  }

  if (lookup.kind === "expired") {
    return (
      <InfoCard
        title="Invitation expired"
        description="Invitations are valid for 7 days. Ask the team admin to send a fresh invite."
        ctaHref={viewer ? "/dashboard" : "/"}
        ctaLabel={viewer ? "Back to dashboard" : "Back to home"}
      />
    );
  }

  if (lookup.kind === "revoked") {
    return (
      <InfoCard
        title="Invitation revoked"
        description="The team admin has revoked this invitation."
        ctaHref={viewer ? "/dashboard" : "/"}
        ctaLabel={viewer ? "Back to dashboard" : "Back to home"}
      />
    );
  }

  if (lookup.kind === "accepted") {
    return (
      <InfoCard
        title="Already accepted"
        description="This invitation has already been used. If that wasn't you, ask the admin for a new one."
        ctaHref={viewer ? "/dashboard" : "/sign-in"}
        ctaLabel={viewer ? "Go to dashboard" : "Sign in"}
      />
    );
  }

  if (!viewer) {
    return (
      <SignedOutInviteCard
        teamName={lookup.teamName}
        role={lookup.role}
        inviterName={lookup.inviterName}
        inviterEmail={lookup.inviterEmail}
        invitedEmail={lookup.email}
        token={token}
      />
    );
  }

  return (
    <AcceptInvitationCard
      token={token}
      teamName={lookup.teamName}
      role={lookup.role}
      inviterName={lookup.inviterName}
      inviterEmail={lookup.inviterEmail}
      invitedEmail={lookup.email}
      viewerEmail={viewer.email}
    />
  );
}

type InfoCardProps = {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
};

function InfoCard({ title, description, ctaHref, ctaLabel }: Readonly<InfoCardProps>) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-7 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Button asChild variant="outline" className="self-start">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
