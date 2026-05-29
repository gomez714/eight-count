/**
 * Backfill Team.isPersonal for existing teams.
 *
 * Detection rule: a team is "personal" when both are true:
 *   - Exactly one TeamMember row, with role = "ADMIN"
 *   - Zero TeamInvitation rows with status = "PENDING"
 *
 * That's the shape the welcome wizard always produces. Teams matching
 * the rule are updated to `isPersonal = true`; everything else is left
 * alone. The Prisma migration already defaulted the column to `false`,
 * so this script only ever flips false → true.
 *
 * Run: `npm run db:backfill-personal-teams`
 *      (under the hood: `npx tsx scripts/backfill-personal-teams.ts`)
 *
 * Idempotent: re-runs only flip teams whose `isPersonal` is still false.
 *
 * Flip `DRY_RUN = true` to preview the work without writing.
 */

import "dotenv/config";

import { db } from "@/lib/db";

const DRY_RUN = false;
const MAX_PROCESS = 500;

async function main() {
  console.log(
    `[backfill-personal-teams] starting${DRY_RUN ? " (DRY RUN)" : ""}…`
  );

  // Pull every team that isn't already marked personal, with the counts
  // we need to evaluate the rule in-memory. One query, no per-team round-trips.
  const candidates = await db.team.findMany({
    where: { isPersonal: false },
    take: MAX_PROCESS,
    select: {
      id: true,
      name: true,
      members: {
        select: { role: true },
      },
      _count: {
        select: {
          invitations: { where: { status: "PENDING" } },
        },
      },
    },
  });

  console.log(
    `[backfill-personal-teams] ${candidates.length} non-personal team(s) found (cap ${MAX_PROCESS})`
  );

  let flipped = 0;
  let skipped = 0;

  for (const team of candidates) {
    const isSoloAdmin =
      team.members.length === 1 && team.members[0]?.role === "ADMIN";
    const hasNoPending = team._count.invitations === 0;

    if (!isSoloAdmin || !hasNoPending) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[backfill-personal-teams] WOULD FLIP  ${team.id} "${team.name}"`
      );
      flipped += 1;
      continue;
    }

    await db.team.update({
      where: { id: team.id },
      data: { isPersonal: true },
    });
    console.log(
      `[backfill-personal-teams] FLIPPED      ${team.id} "${team.name}"`
    );
    flipped += 1;
  }

  console.log(
    `[backfill-personal-teams] finished. flipped=${flipped} skipped=${skipped}`
  );
}

main()
  .catch((err) => {
    console.error("[backfill-personal-teams] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
