import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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