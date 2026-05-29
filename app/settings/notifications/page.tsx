import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";

import { DigestToggle } from "./digest-toggle";

export const metadata = {
  title: "Notifications — Eight Count",
  robots: { index: false },
};

export default async function NotificationsSettingsPage() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    redirect("/sign-in?redirect_url=/settings/notifications");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="self-start text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Eight Count
        </Link>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settings · Notifications
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            Email preferences
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose which Eight Count emails land in your inbox. You can change
            these anytime, and every email also has an unsubscribe link.
          </p>
        </div>
      </header>

      <DigestToggle initialEnabled={dbUser.digestEnabled} />

      <p className="text-xs text-muted-foreground">
        Turning the digest off doesn&apos;t affect transactional emails like
        team invitations or account notices — those always go through.
      </p>
    </main>
  );
}
