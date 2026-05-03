/**
 * Backfill onboardingState for existing users.
 *
 * Marks every user who has prior activity (TeamMember, Note, or
 * NoteAssignment row) as having dismissed both the dashboard checklist and
 * all tip groups, so they don't see the onboarding tour on next visit.
 * Brand-new accounts (e.g. invitees who haven't accepted yet, or anyone
 * with no activity) are untouched and will see the tour normally.
 *
 * Run: `npm run db:backfill-onboarding`
 *      (under the hood: `npx tsx scripts/backfill-onboarding-state.ts`)
 *
 * Idempotent: re-runs only update users whose state hasn't been backfilled.
 *
 * ============================================================================
 *  SKIP_EMAILS — local-test override
 * ============================================================================
 * Emails listed here are NOT marked as dismissed even if they have activity,
 * so the tour still shows for them. Useful for walking through onboarding
 * with an account that already has rehearsals / notes / etc.
 *
 * IMPORTANT: clear or trim this list before running the backfill in
 * production — anyone whose email is here will be presented with the
 * onboarding tour despite being an existing user.
 * ============================================================================
 */

import "dotenv/config";

import { db } from "@/lib/db";
import {
  TIP_GROUP_KEYS,
  parseOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding/state";

const SKIP_EMAILS: string[] = [
  "lgomez00714@gmail.com", // ← test account; remove before prod backfill
];

async function main() {
  console.log("[backfill-onboarding] starting…");

  const skip = new Set(SKIP_EMAILS.map((e) => e.trim().toLowerCase()));

  const candidates = await db.user.findMany({
    where: {
      OR: [
        { teamMembers: { some: {} } },
        { notes: { some: {} } },
        { noteAssignments: { some: {} } },
      ],
    },
    select: {
      id: true,
      email: true,
      onboardingState: true,
    },
  });

  console.log(
    `[backfill-onboarding] ${candidates.length} user(s) with prior activity found`
  );

  const now = new Date().toISOString();
  const dismissedState: OnboardingState = {
    checklistDismissedAt: now,
    tipsDismissed: Object.fromEntries(
      TIP_GROUP_KEYS.map((key) => [key, now])
    ) as Record<(typeof TIP_GROUP_KEYS)[number], string>,
  };

  let updated = 0;
  let skipped = 0;
  let alreadyDone = 0;

  for (const user of candidates) {
    if (skip.has(user.email.toLowerCase())) {
      console.log(`[backfill-onboarding] SKIP  ${user.email} (in SKIP_EMAILS)`);
      skipped += 1;
      continue;
    }

    const existing = parseOnboardingState(user.onboardingState);
    if (existing.checklistDismissedAt) {
      alreadyDone += 1;
      continue;
    }

    await db.user.update({
      where: { id: user.id },
      data: { onboardingState: dismissedState },
    });
    console.log(`[backfill-onboarding] DONE  ${user.email}`);
    updated += 1;
  }

  console.log(
    `[backfill-onboarding] finished. updated=${updated} already=${alreadyDone} skipped=${skipped}`
  );
}

main()
  .catch((err) => {
    console.error("[backfill-onboarding] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
