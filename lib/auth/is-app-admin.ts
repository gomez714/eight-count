/**
 * App-admin check (distinct from team-admin role). Used to gate the
 * `/admin/*` surfaces and admin-only feedback actions. Driven by the
 * `ADMIN_EMAILS` env var — a comma-separated allowlist of email
 * addresses. Case-insensitive match against `User.email`.
 *
 * Trade-off vs. a `User.isAppAdmin` column: env is mutable without a
 * migration, which is the right shape while the admin count is one or
 * two. Promote to a column when the admin set grows enough that
 * editing env on every change becomes friction.
 */

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAppAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}
