"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";

import { NOTE_STATUSES } from "./types";

const updateStatusSchema = z.object({
  noteAssignmentId: z.string().min(1),
  status: z.enum(NOTE_STATUSES),
});

export type UpdateNoteAssignmentStatusInput = z.infer<typeof updateStatusSchema>;

export type UpdateNoteAssignmentStatusResult = {
  error?: string;
  success?: boolean;
};

export async function updateNoteAssignmentStatus(
  input: UpdateNoteAssignmentStatusInput
): Promise<UpdateNoteAssignmentStatusResult> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateStatusSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid status.",
    };
  }

  const { noteAssignmentId, status } = parsed.data;

  const assignment = await db.noteAssignment.findUnique({
    where: {
      id: noteAssignmentId,
    },
  });

  if (!assignment || assignment.userId !== dbUser.id) {
    return {
      error: "You can only update your own assignments.",
    };
  }

  try {
    await db.noteAssignmentStatus.upsert({
      where: {
        noteAssignmentId: assignment.id,
      },
      create: {
        noteAssignmentId: assignment.id,
        status,
        updatedByUserId: dbUser.id,
      },
      update: {
        status,
        updatedByUserId: dbUser.id,
      },
    });

    revalidatePath("/my-notes");

    return { success: true };
  } catch (error) {
    console.error("Failed to update note assignment status:", error);
    return {
      error: "Something went wrong while updating the status.",
    };
  }
}
