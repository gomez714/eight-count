"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";

const REHEARSAL_AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);
const PROJECT_MANAGE_ROLES = new Set(["ADMIN", "INSTRUCTOR"]);

const updateProjectSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Project title must be at least 2 characters."),
  description: z.string().trim().optional(),
});

export type UpdateProjectState = {
  error?: string;
  success?: boolean;
};

export async function updateProject(
  _prevState: UpdateProjectState,
  formData: FormData
): Promise<UpdateProjectState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateProjectSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") || "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid project data.",
    };
  }

  const { projectId, title, description } = parsed.data;

  const project = await getProjectForUser(projectId, dbUser.id);

  if (!project) {
    return { error: "You do not have access to this project." };
  }

  const role = project.team.members[0]?.role;
  if (!role || !PROJECT_MANAGE_ROLES.has(role)) {
    return {
      error: "Only admins and instructors can update projects.",
    };
  }

  try {
    await db.project.update({
      where: { id: projectId },
      data: {
        title,
        description: description || null,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/teams/${project.teamId}`);
    // Notes pages render NoteRehearsalLink (project › rehearsal title)
    // so a project rename leaves them stale until visited otherwise.
    revalidatePath("/my-notes");
    revalidatePath("/notes-by-me");

    return { success: true };
  } catch (error) {
    console.error("Failed to update project:", error);
    return { error: "Something went wrong while updating the project." };
  }
}

const createRehearsalSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Rehearsal title must be at least 2 characters."),
  description: z.string().trim().optional(),
  rehearsalDate: z.string().min(1, "Rehearsal date is required."),
});

export type CreateRehearsalState = {
  error?: string;
  success?: boolean;
};

export async function createRehearsal(
  _prevState: CreateRehearsalState,
  formData: FormData
): Promise<CreateRehearsalState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = createRehearsalSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    rehearsalDate: formData.get("rehearsalDate"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid rehearsal data.",
    };
  }

  const { projectId, title, description, rehearsalDate } = parsed.data;

  const project = await getProjectForUser(projectId, dbUser.id);

  if (!project) {
    return { error: "You do not have access to this project." };
  }

  const callerMembership = project.team.members[0];
  if (
    !callerMembership ||
    !REHEARSAL_AUTHOR_ROLES.has(callerMembership.role)
  ) {
    return {
      error:
        "Only admins, instructors, and assistants can create rehearsals.",
    };
  }

  const parsedDate = new Date(rehearsalDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return { error: "Please provide a valid rehearsal date." };
  }

  try {
    await db.rehearsal.create({
      data: {
        projectId,
        title,
        description: description || null,
        rehearsalDate: parsedDate,
        createdByUserId: dbUser.id,
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to create rehearsal:", error);
    return { error: "Something went wrong while creating the rehearsal." };
  }
}