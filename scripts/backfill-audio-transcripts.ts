/**
 * Backfill voice-note transcripts.
 *
 * Walks AudioAsset rows that were uploaded before transcription shipped
 * (`transcriptStatus = PENDING` AND `status = READY`) and runs each one
 * through the same Deepgram pipeline new uploads use. After this runs,
 * all existing voice notes will have transcripts (or a recorded FAILED
 * state with an error you can inspect / retry).
 *
 * Run: `npm run db:backfill-transcripts`
 *      (under the hood: `npx tsx scripts/backfill-audio-transcripts.ts`)
 *
 * Idempotent: re-runs only process rows still at PENDING. Safe to run
 * multiple times — second run just drains anything the first missed.
 *
 * ============================================================================
 *  Tunables — review before running in prod
 * ============================================================================
 * - DRY_RUN: when true, lists rows that would be processed but doesn't
 *   call Deepgram and doesn't write to the DB. Always do a dry run first.
 * - MAX_PROCESS: hard cap so a first run can't accidentally rack up cost.
 *   Re-run with a higher cap (or remove the cap) once you've verified the
 *   dry-run output looks reasonable.
 * - REQUEST_DELAY_MS: small polite delay between requests so we don't burst
 *   Deepgram. Their rate limit is high but there's no upside to bursting.
 * ============================================================================
 */

import "dotenv/config";

import { db } from "@/lib/db";
import { runTranscription } from "@/lib/transcription/run";

const DRY_RUN = false;
const MAX_PROCESS = 100;
const REQUEST_DELAY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(
    `[backfill-transcripts] starting… (DRY_RUN=${DRY_RUN}, MAX_PROCESS=${MAX_PROCESS})`
  );

  const candidates = await db.audioAsset.findMany({
    where: {
      transcriptStatus: "PENDING",
      status: "READY",
    },
    select: { id: true, originalFileName: true, durationMs: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PROCESS,
  });

  console.log(
    `[backfill-transcripts] ${candidates.length} audio asset(s) eligible for transcription`
  );

  if (candidates.length === 0) {
    console.log("[backfill-transcripts] nothing to do.");
    return;
  }

  if (DRY_RUN) {
    for (const asset of candidates) {
      console.log(
        `[backfill-transcripts] DRY  ${asset.id}  (${asset.originalFileName}, ${
          asset.durationMs ?? "?"
        }ms)`
      );
    }
    console.log(
      `[backfill-transcripts] DRY_RUN — set DRY_RUN=false to run for real.`
    );
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (const asset of candidates) {
    console.log(
      `[backfill-transcripts] >>> ${asset.id}  (${asset.originalFileName})`
    );

    // runTranscription never throws — it persists FAILED on its own.
    await runTranscription(asset.id);

    // Re-fetch so we can log the outcome without re-implementing the state
    // machine here.
    const after = await db.audioAsset.findUnique({
      where: { id: asset.id },
      select: { transcriptStatus: true, transcript: true },
    });

    if (after?.transcriptStatus === "READY") {
      const preview = (after.transcript ?? "").slice(0, 60);
      console.log(
        `[backfill-transcripts] OK   ${asset.id}  "${preview}${
          (after.transcript ?? "").length > 60 ? "…" : ""
        }"`
      );
      succeeded += 1;
    } else {
      console.log(
        `[backfill-transcripts] FAIL ${asset.id}  (status=${
          after?.transcriptStatus ?? "?"
        })`
      );
      failed += 1;
    }

    await delay(REQUEST_DELAY_MS);
  }

  console.log(
    `[backfill-transcripts] finished. succeeded=${succeeded} failed=${failed}`
  );
}

main()
  .catch((err) => {
    console.error("[backfill-transcripts] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
