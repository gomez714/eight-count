"use server";

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/digest/token";

export type ResubscribeResult = { ok?: true; error?: string };

/**
 * Re-enables the digest for a user who just unsubscribed. Takes the
 * same signed token as the unsubscribe link so the only callers who
 * can flip a flag are those who already proved possession of the
 * email. Re-verifying server-side (instead of trusting a userId from
 * the client) means a leaked DOM doesn't grant the action.
 */
export async function resubscribeFromTokenAction(
  token: string
): Promise<ResubscribeResult> {
  if (!token) return { error: "Missing token." };

  const userId = verifyUnsubscribeToken(token);
  if (!userId) return { error: "Invalid token." };

  try {
    await db.user.update({
      where: { id: userId },
      data: { digestEnabled: true },
    });
    return { ok: true };
  } catch (error) {
    console.error(
      `[digest-unsubscribe] resubscribe failed for user=${userId}:`,
      error
    );
    return { error: "Could not re-subscribe. Try again in a moment." };
  }
}
