"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

const REHEARSAL_AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

const updateRehearsalSchema = z.object({
  rehearsalId: z.string().min(1),
  title: z.string().trim().min(2, "Rehearsal title must be at least 2 characters."),
  description: z.string().trim().optional(),
  rehearsalDate: z.string().min(1, "Rehearsal date is required."),
});

export type UpdateRehearsalState = {
  error?: string;
  success?: boolean;
};

export async function updateRehearsal(
  _prevState: UpdateRehearsalState,
  formData: FormData
): Promise<UpdateRehearsalState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateRehearsalSchema.safeParse({
    rehearsalId: formData.get("rehearsalId"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    rehearsalDate: formData.get("rehearsalDate"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid rehearsal data.",
    };
  }

  const { rehearsalId, title, description, rehearsalDate } = parsed.data;

  const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);

  if (!rehearsal) {
    return { error: "You do not have access to this rehearsal." };
  }

  const role = rehearsal.project.team.members.find(
    (m) => m.userId === dbUser.id
  )?.role;
  if (!role || !REHEARSAL_AUTHOR_ROLES.has(role)) {
    return {
      error: "Only admins, instructors, and assistants can update rehearsals.",
    };
  }

  const parsedDate = new Date(rehearsalDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return { error: "Please provide a valid rehearsal date." };
  }

  try {
    await db.rehearsal.update({
      where: { id: rehearsalId },
      data: {
        title,
        description: description || null,
        rehearsalDate: parsedDate,
      },
    });

    revalidatePath(`/rehearsals/${rehearsalId}`);
    revalidatePath(`/projects/${rehearsal.projectId}`);
    // Notes pages render NoteRehearsalLink (project › rehearsal title)
    // so a rehearsal rename leaves them stale until visited otherwise.
    revalidatePath("/my-notes");
    revalidatePath("/notes-by-me");

    return { success: true };
  } catch (error) {
    console.error("Failed to update rehearsal:", error);
    return { error: "Something went wrong while updating the rehearsal." };
  }
}
