import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless unsubscribe token for digest emails.
 *
 * Format: `<userId>.<base64url-hmac-sha256>`. The HMAC binds the userId
 * to a server-side secret so the token can be verified without a DB
 * lookup AND can't be forged or repurposed across users.
 *
 * Reuses `CRON_SECRET` rather than introducing a separate
 * `DIGEST_TOKEN_SECRET`. For the beta scale this keeps the env surface
 * small; rotating to a dedicated secret later is a drop-in change
 * (`tokenSecret()` is the one place that picks it).
 *
 * Tokens are stateless — no expiry, no revocation list. The token is
 * also not meaningfully sensitive: the worst case if someone intercepts
 * it (e.g. forwarded email) is they can toggle the user's digest off;
 * they cannot read the user's data with it. If we ever need short-lived
 * tokens we'd add an `issuedAt` claim and verify it server-side.
 */

function tokenSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "CRON_SECRET is not set (or too short) — required to sign digest tokens."
    );
  }
  return secret;
}

function sign(userId: string): string {
  return createHmac("sha256", tokenSecret())
    .update(userId)
    .digest("base64url");
}

export function signUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/**
 * Returns the userId when the token is valid, otherwise null. Uses
 * timing-safe comparison so attackers can't brute-force one byte at a
 * time by measuring response time.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(userId);
  } catch {
    return null;
  }

  const a = Buffer.from(provided, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? userId : null;
}
