import { db } from "@/lib/db";
import { hashInvitationToken } from "@/lib/invitations/token";

export type InvitationLookupResult =
  | {
      kind: "ok";
      invitationId: string;
      teamId: string;
      teamName: string;
      email: string;
      role: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";
      inviterName: string | null;
      inviterEmail: string;
      expiresAt: Date;
    }
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "accepted" };

/**
 * Server-side lookup of an invitation by its raw token (the value in the
 * email link). Hashes the token before querying so the raw value never
 * leaves the request handler. Returns a discriminated result so the
 * acceptance page can render the right state without leaking details.
 */
export async function lookupInvitationByToken(
  rawToken: string
): Promise<InvitationLookupResult> {
  if (!rawToken) return { kind: "not_found" };

  const tokenHash = hashInvitationToken(rawToken);
  const invitation = await db.teamInvitation.findUnique({
    where: { tokenHash },
    include: {
      team: { select: { id: true, name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) return { kind: "not_found" };
  if (invitation.status === "REVOKED") return { kind: "revoked" };
  if (invitation.status === "ACCEPTED") return { kind: "accepted" };

  if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
    return { kind: "expired" };
  }

  return {
    kind: "ok",
    invitationId: invitation.id,
    teamId: invitation.team.id,
    teamName: invitation.team.name,
    email: invitation.email,
    role: invitation.role,
    inviterName: invitation.invitedBy.name,
    inviterEmail: invitation.invitedBy.email,
    expiresAt: invitation.expiresAt,
  };
}
