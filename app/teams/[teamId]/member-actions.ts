"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getTeamForUser } from "@/lib/teams/get-team-for-user";

const addTeamMemberSchema = z.object({
  teamId: z.string().min(1),
  email: z.email("Please enter a valid email address.").transform((value) =>
    value.trim().toLowerCase()
  ),
  role: z.enum(["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"]),
});

export type AddTeamMemberState = {
  error?: string;
  success?: boolean;
};

export async function addTeamMember(
  _prevState: AddTeamMemberState,
  formData: FormData
): Promise<AddTeamMemberState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = addTeamMemberSchema.safeParse({
    teamId: formData.get("teamId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid member data.",
    };
  }

  const { teamId, email, role } = parsed.data;

  const team = await getTeamForUser(teamId, dbUser.id);

  if (!team) {
    return { error: "You do not have access to this team." };
  }

  const callerMembership = team.members[0];

  if (callerMembership?.role !== "ADMIN") {
    return { error: "Only team admins can add new members." };
  }

  const existingUser = await db.user.findUnique({
    where: {
      email,
    },
  });

  if (!existingUser) {
    return {
      error:
        "No existing user found with that email. They need to sign up first.",
    };
  }

  const existingMembership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: existingUser.id,
      },
    },
  });

  if (existingMembership) {
    return {
      error: "That user is already a member of this team.",
    };
  }

  try {
    await db.teamMember.create({
      data: {
        teamId,
        userId: existingUser.id,
        role,
      },
    });

    revalidatePath(`/teams/${teamId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to add team member:", error);
    return { error: "Something went wrong while adding the team member." };
  }
}