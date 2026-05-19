"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";
import { getResourceForUser } from "@/lib/resources/get-resource-for-user";
import {
  createResourceSchema,
  updateResourceSchema,
} from "@/lib/resources/validation";

/**
 * Roles permitted to author / edit / delete resources. Matches the
 * note-authoring set (staff-only) — see CLAUDE.md "Role-Based
 * Permissions" for the rationale (resources are production documents,
 * which flow downward from authority, not horizontally like discussions).
 */
const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

export type ResourceActionResult = {
  error?: string;
  success?: boolean;
  resourceId?: string;
};

const createInputSchema = createResourceSchema.extend({
  projectId: z.string().min(1),
});

const updateInputSchema = updateResourceSchema.extend({
  resourceId: z.string().min(1),
});

const deleteInputSchema = z.object({
  resourceId: z.string().min(1),
});

export async function createResource(
  _prevState: ResourceActionResult,
  formData: FormData
): Promise<ResourceActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = createInputSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    url: formData.get("url"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid resource data.",
    };
  }

  const { projectId, title, url, description } = parsed.data;

  const project = await getProjectForUser(projectId, dbUser.id);
  if (!project) {
    return { error: "You do not have access to this project." };
  }

  const role = project.team.members[0]?.role;
  if (!role || !AUTHOR_ROLES.has(role)) {
    return {
      error: "Only admins, instructors, and assistants can add resources.",
    };
  }

  try {
    const created = await db.projectResource.create({
      data: {
        projectId,
        createdByUserId: dbUser.id,
        title,
        url,
        description,
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, resourceId: created.id };
  } catch (error) {
    console.error("Failed to create resource:", error);
    return { error: "Something went wrong while adding the resource." };
  }
}

export async function updateResource(
  _prevState: ResourceActionResult,
  formData: FormData
): Promise<ResourceActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateInputSchema.safeParse({
    resourceId: formData.get("resourceId"),
    title: formData.get("title"),
    url: formData.get("url"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid resource data.",
    };
  }

  const { resourceId, title, url, description } = parsed.data;

  const existing = await getResourceForUser(resourceId, dbUser.id);
  if (!existing) {
    return { error: "Resource not found." };
  }

  // Author-only — staff role doesn't grant override-edit. Matches the
  // note + discussion edit gates.
  if (existing.createdByUserId !== dbUser.id) {
    return { error: "Only the original author can edit this resource." };
  }

  try {
    await db.projectResource.update({
      where: { id: resourceId },
      data: {
        title,
        url,
        description,
      },
    });

    revalidatePath(`/projects/${existing.projectId}`);

    return { success: true, resourceId };
  } catch (error) {
    console.error("Failed to update resource:", error);
    return { error: "Something went wrong while updating the resource." };
  }
}

export async function deleteResource(
  input: z.infer<typeof deleteInputSchema>
): Promise<ResourceActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = deleteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { resourceId } = parsed.data;

  const existing = await getResourceForUser(resourceId, dbUser.id);
  if (!existing) {
    return { error: "Resource not found." };
  }

  if (existing.createdByUserId !== dbUser.id) {
    return { error: "Only the original author can delete this resource." };
  }

  try {
    await db.projectResource.delete({
      where: { id: resourceId },
    });

    revalidatePath(`/projects/${existing.projectId}`);

    return { success: true, resourceId };
  } catch (error) {
    console.error("Failed to delete resource:", error);
    return { error: "Something went wrong while deleting the resource." };
  }
}
