import { createHash, randomBytes } from "node:crypto";

export type GeneratedToken = {
  raw: string;
  hash: string;
};

export function generateInvitationToken(): GeneratedToken {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashInvitationToken(raw) };
}

export function hashInvitationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const INVITATION_TTL_DAYS = 7;

export function invitationExpiry(now: Date = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);
  return expiresAt;
}
