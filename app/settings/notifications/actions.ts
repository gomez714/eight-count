"use server";

import { revalidatePath } from "next/cache";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";

export type ToggleDigestResult = { ok?: true; error?: string };

export async function setDigestEnabledAction(
  enabled: boolean
): Promise<ToggleDigestResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  await db.user.update({
    where: { id: dbUser.id },
    data: { digestEnabled: enabled },
  });

  revalidatePath("/settings/notifications");
  return { ok: true };
}
