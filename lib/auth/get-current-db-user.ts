import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function getCurrentDbUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });
}