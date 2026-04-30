"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";

const MANAGE_ROLES = new Set(["ADMIN", "INSTRUCTOR"]);

const createGroupSchema = z.object({
  projectId: z.string().min(1),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(80, "Name must be 80 characters or less.")
    .transform((value) => value.trim()),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less.")
    .optional()
    .transform((value) => value?.trim() || null),
});

const updateGroupMembersSchema = z.object({
  projectId: z.string().min(1),
  groupId: z.string().min(1),
  teamMemberIds: z.array(z.string().min(1)).default([]),
});

const deleteGroupSchema = z.object({
  projectId: z.string().min(1),
  groupId: z.string().min(1),
});

export type GroupActionResult = {
  error?: string;
  success?: boolean;
};

async function loadProjectAndCheckPermission(
  projectId: string,
  userId: string
) {
  const project = await getProjectForUser(projectId, userId);
  if (!project) {
    return { error: "You do not have access to this project." } as const;
  }
  const callerMembership = project.team.members[0];
  if (!callerMembership || !MANAGE_ROLES.has(callerMembership.role)) {
    return {
      error: "Only admins and instructors can manage project groups.",
    } as const;
  }
  return { project } as const;
}

export async function createProjectGroup(
  _prevState: GroupActionResult,
  formData: FormData
): Promise<GroupActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = createGroupSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid group data.",
    };
  }

  const { projectId, name, description } = parsed.data;

  const guard = await loadProjectAndCheckPermission(projectId, dbUser.id);
  if ("error" in guard) {
    return { error: guard.error };
  }

  try {
    await db.projectGroup.create({
      data: {
        projectId,
        name,
        description,
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to create project group:", error);
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { error: "A group with that name already exists." };
    }
    return { error: "Something went wrong while creating the group." };
  }
}

export async function updateProjectGroupMembers(
  input: z.infer<typeof updateGroupMembersSchema>
): Promise<GroupActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = updateGroupMembersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { projectId, groupId, teamMemberIds } = parsed.data;

  const guard = await loadProjectAndCheckPermission(projectId, dbUser.id);
  if ("error" in guard) {
    return { error: guard.error };
  }

  const group = await db.projectGroup.findFirst({
    where: { id: groupId, projectId },
    include: {
      project: {
        include: {
          team: {
            include: {
              members: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!group) {
    return { error: "Group not found." };
  }

  const validTeamMemberIds = new Set(
    group.project.team.members.map((member) => member.id)
  );
  const invalid = teamMemberIds.find(
    (id) => !validTeamMemberIds.has(id)
  );
  if (invalid) {
    return {
      error: "One or more selected members are not on this team.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.projectGroupMember.deleteMany({
        where: { projectGroupId: groupId },
      });

      if (teamMemberIds.length > 0) {
        await tx.projectGroupMember.createMany({
          data: teamMemberIds.map((teamMemberId) => ({
            projectGroupId: groupId,
            teamMemberId,
          })),
        });
      }
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update group members:", error);
    return { error: "Something went wrong while updating members." };
  }
}

export async function deleteProjectGroup(
  input: z.infer<typeof deleteGroupSchema>
): Promise<GroupActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { projectId, groupId } = parsed.data;

  const guard = await loadProjectAndCheckPermission(projectId, dbUser.id);
  if ("error" in guard) {
    return { error: guard.error };
  }

  const group = await db.projectGroup.findFirst({
    where: { id: groupId, projectId },
  });

  if (!group) {
    return { error: "Group not found." };
  }

  try {
    await db.projectGroup.delete({
      where: { id: groupId },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete project group:", error);
    return { error: "Something went wrong while deleting the group." };
  }
}
