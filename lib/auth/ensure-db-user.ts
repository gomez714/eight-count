import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Sync the local `User` row from Clerk on every authenticated request.
 *
 * Three paths:
 * 1. **Existing match by clerkUserId** → update name/email/imageUrl
 *    (the common case — same user signing in again).
 * 2. **No match by clerkUserId, but a row exists for the same email** →
 *    *reclaim* it. This handles two adjacent scenarios:
 *      - The user was soft-deleted (`deletedAt` set) and is signing up
 *        again — they get their notes/teams/history back.
 *      - The user was hard-deleted from Clerk (orphaning the DB row),
 *        signed up again, and Clerk gave them a new `clerkUserId`.
 *    In both cases, attaching the new Clerk identity beats failing on
 *    the email unique constraint and locking them out of sign-up.
 * 3. **No row at all** → create a fresh User row.
 */
export async function ensureDbUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const existingUser = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Authenticated Clerk user has no email address.");
  }

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    null;

  if (existingUser) {
    return db.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        email: primaryEmail,
        name: fullName,
        imageUrl: clerkUser.imageUrl,
        // Defensive: a row reachable by clerkUserId is always considered
        // active. Clearing deletedAt covers any drift between Clerk's
        // user state and ours (e.g. a manual soft-delete that didn't
        // also revoke the Clerk session).
        deletedAt: null,
      },
    });
  }

  // Reclaim path — see file-level docstring.
  const orphan = await db.user.findUnique({
    where: { email: primaryEmail },
  });

  if (orphan) {
    console.info(
      `[auth] reclaiming orphan User row for ${primaryEmail} (was clerkUserId=${orphan.clerkUserId}, now ${userId})`
    );
    return db.user.update({
      where: { id: orphan.id },
      data: {
        clerkUserId: userId,
        name: fullName,
        imageUrl: clerkUser.imageUrl,
        deletedAt: null,
      },
    });
  }

  return db.user.create({
    data: {
      clerkUserId: userId,
      email: primaryEmail,
      name: fullName,
      imageUrl: clerkUser.imageUrl,
    },
  });
}
