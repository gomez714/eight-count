import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";

import { FeedbackLauncherClient } from "./feedback-launcher-client";

/**
 * Server-gated entry for the global feedback widget. Mounted in
 * [components/app-header.tsx] between the team switcher / theme toggle
 * and the UserButton. Returns null on signed-out pages so the icon
 * doesn't render on landing / sign-in / sign-up / `/invite/[token]` /
 * `/privacy`.
 */
export async function FeedbackLauncher() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return null;
  return <FeedbackLauncherClient />;
}
