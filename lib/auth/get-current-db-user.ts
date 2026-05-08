import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Read-only sibling of `ensureDbUser` for server components that don't
 * mutate. Returns the active User row matching the current Clerk session,
 * or null if not signed in / no row / row is soft-deleted.
 *
 * Note: an authenticated session pointing at a soft-deleted row is an
 * unusual state — `ensureDbUser` clears `deletedAt` whenever a session
 * lands, so this should only ever return null for soft-deleted rows in
 * a brief window before the next mutation. Treat it as "not signed in"
 * and let the next protected page redirect to sign-in.
 */
export async function getCurrentDbUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return db.user.findFirst({
    where: {
      clerkUserId: userId,
      deletedAt: null,
    },
  });
}