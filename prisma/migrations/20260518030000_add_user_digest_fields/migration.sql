-- AlterTable: opt-in by default for both existing and new users. The
-- sign-up form, invitation email, and every digest's footer disclose
-- the opt-out path, so defaulting true is consistent with the user's
-- consent at sign-up. The cron route also enforces a 24h grace window
-- after sign-up so first-time users never receive a "here's what
-- happened" email before they've finished exploring.
ALTER TABLE "User"
  ADD COLUMN "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastDigestSentAt" TIMESTAMP(3);
