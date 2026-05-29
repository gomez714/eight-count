"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getTeamForUser } from "@/lib/teams/get-team-for-user";

const MANAGE_ROLES = new Set(["ADMIN", "INSTRUCTOR"]);

const updateTeamSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().trim().min(2, "Team name must be at least 2 characters."),
});

export type UpdateTeamState = {
  error?: string;
  success?: boolean;
};

export async function updateTeam(
  _prevState: UpdateTeamState,
  formData: FormData
): Promise<UpdateTeamState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateTeamSchema.safeParse({
    teamId: formData.get("teamId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid team data.",
    };
  }

  const { teamId, name } = parsed.data;

  const team = await getTeamForUser(teamId, dbUser.id);

  if (!team) {
    return { error: "You do not have access to this team." };
  }

  if (team.members[0]?.role !== "ADMIN") {
    return { error: "Only admins can rename a team." };
  }

  try {
    await db.team.update({
      where: { id: teamId },
      data: { name },
    });

    revalidatePath(`/teams/${teamId}`);
    revalidatePath("/dashboard");
    // Bust the root layout cache so the AppHeader's team switcher
    // picks up the new name without a hard refresh.
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to update team:", error);
    return { error: "Something went wrong while updating the team." };
  }
}

const createProjectSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().min(2, "Project title must be at least 2 characters."),
  description: z.string().trim().optional(),
});

export type CreateProjectState = {
  error?: string;
  success?: boolean;
};

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = createProjectSchema.safeParse({
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project data.",
    };
  }

  const { teamId, title, description } = parsed.data;

  const team = await getTeamForUser(teamId, dbUser.id);

  if (!team) {
    return { error: "You do not have access to this team." };
  }

  const callerMembership = team.members[0];
  if (!callerMembership || !MANAGE_ROLES.has(callerMembership.role)) {
    return {
      error: "Only admins and instructors can create projects.",
    };
  }

  try {
    await db.project.create({
      data: {
        teamId,
        title,
        description: description || null,
        createdByUserId: dbUser.id,
      },
    });

    revalidatePath(`/teams/${teamId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to create project:", error);
    return { error: "Something went wrong while creating the project." };
  }
}