"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email/send";
import {
  generateInvitationToken,
  invitationExpiry,
} from "@/lib/invitations/token";
import { getTeamForUser } from "@/lib/teams/get-team-for-user";

const inviteSchema = z.object({
  teamId: z.string().min(1),
  email: z
    .email("Please enter a valid email address.")
    .transform((value) => value.trim().toLowerCase()),
  role: z.enum(["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"]),
});

export type InviteTeamMemberState = {
  error?: string;
  success?: boolean;
};

export async function inviteTeamMember(
  _prevState: InviteTeamMemberState,
  formData: FormData
): Promise<InviteTeamMemberState> {
  const dbUser = await ensureDbUser();

  if (!dbUser) {
    return { error: "You must be signed in." };
  }

  const parsed = inviteSchema.safeParse({
    teamId: formData.get("teamId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid invitation data.",
    };
  }

  const { teamId, email, role } = parsed.data;

  const team = await getTeamForUser(teamId, dbUser.id);

  if (!team) {
    return { error: "You do not have access to this team." };
  }

  if (team.members[0]?.role !== "ADMIN") {
    return { error: "Only team admins can invite new members." };
  }

  if (email === dbUser.email.toLowerCase()) {
    return { error: "You're already a member of this team." };
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: existingUser.id },
      },
    });
    if (existingMembership) {
      return { error: "That person is already a member of this team." };
    }
  }

  const existingPending = await db.teamInvitation.findFirst({
    where: { teamId, email, status: "PENDING" },
  });
  if (existingPending) {
    return {
      error:
        "An invitation is already pending for this email. Resend or revoke it first.",
    };
  }

  const { raw, hash } = generateInvitationToken();
  const expiresAt = invitationExpiry();

  await db.teamInvitation.create({
    data: {
      teamId,
      email,
      role,
      tokenHash: hash,
      invitedByUserId: dbUser.id,
      expiresAt,
    },
  });

  try {
    await sendInvitationEmail({
      to: email,
      teamName: team.name,
      inviterName: dbUser.name,
      inviterEmail: dbUser.email,
      role,
      rawToken: raw,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    return {
      error:
        "Invitation saved but the email couldn't be sent. Try resending it.",
    };
  }

  revalidatePath(`/teams/${teamId}`);
  return { success: true };
}

const invitationIdSchema = z.object({
  teamId: z.string().min(1),
  invitationId: z.string().min(1),
});

export type InvitationActionState = {
  error?: string;
  success?: boolean;
};

export async function revokeInvitation(
  input: z.infer<typeof invitationIdSchema>
): Promise<InvitationActionState> {
  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invitation." };

  const team = await getTeamForUser(parsed.data.teamId, dbUser.id);
  if (!team) return { error: "You do not have access to this team." };
  if (team.members[0]?.role !== "ADMIN") {
    return { error: "Only team admins can revoke invitations." };
  }

  const invitation = await db.teamInvitation.findFirst({
    where: { id: parsed.data.invitationId, teamId: team.id },
  });
  if (!invitation) return { error: "Invitation not found." };
  if (invitation.status !== "PENDING") {
    return { error: "This invitation is no longer pending." };
  }

  await db.teamInvitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });

  revalidatePath(`/teams/${team.id}`);
  return { success: true };
}

export async function resendInvitation(
  input: z.infer<typeof invitationIdSchema>
): Promise<InvitationActionState> {
  const dbUser = await ensureDbUser();
  if (!dbUser) return { error: "You must be signed in." };

  const parsed = invitationIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid invitation." };

  const team = await getTeamForUser(parsed.data.teamId, dbUser.id);
  if (!team) return { error: "You do not have access to this team." };
  if (team.members[0]?.role !== "ADMIN") {
    return { error: "Only team admins can resend invitations." };
  }

  const invitation = await db.teamInvitation.findFirst({
    where: { id: parsed.data.invitationId, teamId: team.id },
  });
  if (!invitation) return { error: "Invitation not found." };
  if (invitation.status !== "PENDING" && invitation.status !== "EXPIRED") {
    return {
      error: "This invitation can't be resent (it's already been accepted or revoked).",
    };
  }

  const { raw, hash } = generateInvitationToken();
  const expiresAt = invitationExpiry();

  await db.teamInvitation.update({
    where: { id: invitation.id },
    data: {
      tokenHash: hash,
      expiresAt,
      status: "PENDING",
    },
  });

  try {
    await sendInvitationEmail({
      to: invitation.email,
      teamName: team.name,
      inviterName: dbUser.name,
      inviterEmail: dbUser.email,
      role: invitation.role,
      rawToken: raw,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to resend invitation email:", error);
    return { error: "Could not send the email. Try again in a moment." };
  }

  revalidatePath(`/teams/${team.id}`);
  return { success: true };
}
