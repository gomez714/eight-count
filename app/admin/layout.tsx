import { redirect } from "next/navigation";

import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";
import { isAppAdmin } from "@/lib/auth/is-app-admin";

/**
 * Wraps every `/admin/*` route in the app-admin gate. Non-admins
 * (or signed-out users) are bounced to `/dashboard` rather than shown
 * a 403 — the surface is intentionally unlisted, so we don't want to
 * confirm to a curious user that "yes, /admin exists, you just can't
 * see it." Just send them home.
 *
 * Admin membership is driven by the `ADMIN_EMAILS` env var — see
 * `lib/auth/is-app-admin.ts`. Adding/removing admins requires no
 * migration, just an env var update + redeploy.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser || !isAppAdmin(dbUser.email)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
