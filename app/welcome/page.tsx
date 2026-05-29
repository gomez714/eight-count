import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand-lockup";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";

import { WelcomeWizard } from "./welcome-wizard";

export default async function WelcomePage() {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    redirect("/sign-in?redirect_url=/welcome");
  }

  const membershipCount = await db.teamMember.count({
    where: { userId: dbUser.id },
  });
  if (membershipCount > 0) {
    redirect("/dashboard");
  }

  const firstName = dbUser.name?.trim().split(/\s+/)[0] ?? null;
  const defaultWorkspaceName = firstName
    ? `${firstName}'s workspace`
    : "My workspace";
  const defaultRehearsalTitle = `Rehearsal — ${formatToday()}`;

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center p-6 sm:p-12">
      <div className="flex w-full max-w-md flex-col items-start gap-8">
        <BrandLockup size="sm" />
        <WelcomeWizard
          firstName={firstName}
          defaultWorkspaceName={defaultWorkspaceName}
          defaultProjectTitle="Untitled show"
          defaultRehearsalTitle={defaultRehearsalTitle}
        />
      </div>
    </div>
  );
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date());
}
