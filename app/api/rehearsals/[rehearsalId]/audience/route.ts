import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type { AudienceResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!dbUser) {
      return apiError(401, "USER_NOT_FOUND", "User not found");
    }

    const { rehearsalId } = await context.params;

    const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);
    if (!rehearsal) {
      return apiError(
        404,
        "REHEARSAL_NOT_FOUND",
        "Rehearsal not found or access denied"
      );
    }

    const assignableMembers = rehearsal.project.team.members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    }));

    const availableGroups = rehearsal.project.groups.map((group) => ({
      id: group.id,
      name: group.name,
      memberUserIds: group.members.map((m) => m.teamMember.userId),
    }));

    return NextResponse.json<AudienceResponse>({
      ok: true,
      data: { assignableMembers, availableGroups },
    });
  } catch (error) {
    console.error("Failed to load audience:", error);
    return apiError(
      500,
      "AUDIENCE_FAILED",
      error instanceof Error ? error.message : "Failed to load audience"
    );
  }
}
