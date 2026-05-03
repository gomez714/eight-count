import { NextResponse } from "next/server";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { hashInvitationToken } from "@/lib/invitations/token";
import { apiError, type ApiResponse } from "@/lib/api/responses";

type AcceptResponse = {
  teamId: string;
  teamName: string;
};

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(
  _request: Request,
  ctx: RouteContext
): Promise<NextResponse<ApiResponse<AcceptResponse>>> {
  const { token } = await ctx.params;
  if (!token) {
    return apiError(400, "BAD_REQUEST", "Missing invitation token.");
  }

  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return apiError(401, "UNAUTHORIZED", "Sign in to accept this invitation.");
  }

  const tokenHash = hashInvitationToken(token);
  const invitation = await db.teamInvitation.findUnique({
    where: { tokenHash },
    include: { team: { select: { id: true, name: true } } },
  });

  if (!invitation) {
    return apiError(404, "NOT_FOUND", "This invitation link is invalid.");
  }

  if (invitation.status === "REVOKED") {
    return apiError(410, "REVOKED", "This invitation has been revoked.");
  }
  if (invitation.status === "ACCEPTED") {
    return apiError(409, "ALREADY_ACCEPTED", "This invitation has already been accepted.");
  }

  const now = new Date();
  if (invitation.status === "EXPIRED" || invitation.expiresAt < now) {
    if (invitation.status !== "EXPIRED") {
      await db.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
    }
    return apiError(410, "EXPIRED", "This invitation has expired.");
  }

  if (invitation.email.toLowerCase() !== dbUser.email.toLowerCase()) {
    return apiError(
      403,
      "EMAIL_MISMATCH",
      `This invitation was sent to ${invitation.email}, but you're signed in as ${dbUser.email}.`
    );
  }

  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: invitation.teamId, userId: dbUser.id } },
  });

  if (!existing) {
    await db.teamMember.create({
      data: {
        teamId: invitation.teamId,
        userId: dbUser.id,
        role: invitation.role,
      },
    });
  }

  await db.teamInvitation.update({
    where: { id: invitation.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: now,
      acceptedByUserId: dbUser.id,
    },
  });

  return NextResponse.json<ApiResponse<AcceptResponse>>({
    ok: true,
    data: { teamId: invitation.team.id, teamName: invitation.team.name },
  });
}
