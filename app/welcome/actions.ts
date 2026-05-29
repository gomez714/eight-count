"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";

const bootstrapSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(100, "Workspace name is too long.")
    .optional(),
  projectTitle: z
    .string()
    .trim()
    .min(2, "Show name must be at least 2 characters.")
    .max(120, "Show name is too long.")
    .optional(),
  rehearsalTitle: z
    .string()
    .trim()
    .min(2, "Rehearsal name must be at least 2 characters.")
    .max(120, "Rehearsal name is too long.")
    .optional(),
});

export type BootstrapInput = z.input<typeof bootstrapSchema>;

export type BootstrapResult =
  | { success: true; teamId: string; rehearsalId: string }
  | { error: string };

export async function bootstrapFirstWorkspace(
  input: BootstrapInput
): Promise<BootstrapResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const existingMembershipCount = await db.teamMember.count({
    where: { userId: dbUser.id },
  });
  if (existingMembershipCount > 0) {
    return {
      error:
        "You already belong to a workspace. Head to your dashboard to continue.",
    };
  }

  const parsed = bootstrapSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace details.",
    };
  }

  const firstName = dbUser.name?.trim().split(/\s+/)[0] ?? null;
  const workspaceName =
    parsed.data.workspaceName ??
    (firstName ? `${firstName}'s workspace` : "My workspace");
  const projectTitle = parsed.data.projectTitle ?? "Untitled show";
  const rehearsalTitle =
    parsed.data.rehearsalTitle ?? `Rehearsal — ${formatToday()}`;

  try {
    const { teamId, rehearsalId } = await db.$transaction(async (tx) => {
      const team = await tx.team.create({
        // Welcome-wizard teams start in "personal workspace" mode.
        // The first invite-member action flips this back to false.
        data: { name: workspaceName, isPersonal: true },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: dbUser.id,
          role: "ADMIN",
        },
      });

      const project = await tx.project.create({
        data: {
          teamId: team.id,
          title: projectTitle,
          createdByUserId: dbUser.id,
        },
      });

      const rehearsal = await tx.rehearsal.create({
        data: {
          projectId: project.id,
          title: rehearsalTitle,
          rehearsalDate: new Date(),
          createdByUserId: dbUser.id,
        },
      });

      return { teamId: team.id, rehearsalId: rehearsal.id };
    });

    revalidatePath("/dashboard");

    return { success: true, teamId, rehearsalId };
  } catch (error) {
    console.error("[bootstrap] Failed to bootstrap first workspace:", error);
    return {
      error: "Couldn't set up your workspace. Please try again.",
    };
  }
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date());
}
