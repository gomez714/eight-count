"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";

const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters."),
});

export type CreateTeamState = {
  error?: string;
  success?: boolean;
  teamId?: string;
};

export async function createTeam(
  _prevState: CreateTeamState,
  formData: FormData
): Promise<CreateTeamState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid team name.",
    };
  }

  try {
    const team = await db.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name: parsed.data.name,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: created.id,
          userId: dbUser.id,
          role: "ADMIN",
        },
      });

      return created;
    });

    revalidatePath("/dashboard");

    return { success: true, teamId: team.id };
  } catch (error) {
    console.error("Failed to create team:", error);
    return { error: "Something went wrong while creating the team." };
  }
}