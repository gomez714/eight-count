/**
 * Reap stale uploads.
 *
 * Walks VideoAsset and AudioAsset rows that have been sitting at
 * `status = UPLOADING` for longer than STALE_THRESHOLD_HOURS and reconciles
 * each one against GCS:
 *
 *   - Object exists with non-zero size → recover: flip status to READY.
 *     (For audio, also kick off Deepgram transcription so the row catches
 *     up with what the normal /complete route would have done.)
 *   - Object missing or empty → delete the DB row. It's pointing at nothing
 *     and the upload-url route handles fresh attempts cleanly (video reuses
 *     the per-rehearsal row when retried; audio always creates a new row).
 *
 * Run: `npm run db:reap-stale-uploads`
 *      (under the hood: `npx tsx scripts/reap-stale-uploads.ts`)
 *
 * Idempotent: re-runs only consider rows still at UPLOADING. Safe to run
 * multiple times.
 *
 * ============================================================================
 *  Tunables — review before running in prod
 * ============================================================================
 * - DRY_RUN: when true, lists what would happen but doesn't touch GCS or
 *   the DB. Always do a dry run first.
 * - STALE_THRESHOLD_HOURS: minimum age of an UPLOADING row before it's
 *   eligible for reaping. 24 h leaves plenty of room for a slow uploader
 *   to finish — adjust shorter once we trust the upload pipeline more.
 * - MAX_PROCESS: hard cap per run so a misconfigured threshold can't sweep
 *   an unbounded number of rows in one go.
 * ============================================================================
 */

import "dotenv/config";

import { db } from "@/lib/db";
import { statGcsObject } from "@/lib/storage/gcs";
import { runTranscription } from "@/lib/transcription/run";

const DRY_RUN = false;
const STALE_THRESHOLD_HOURS = 24;
const MAX_PROCESS = 200;

type Outcome = "recovered" | "deleted";

function staleCutoff(): Date {
  return new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
}

async function reapVideoAsset(asset: {
  id: string;
  objectPath: string;
  originalFileName: string;
}): Promise<Outcome> {
  const stat = await statGcsObject(asset.objectPath);

  if (stat.exists && stat.sizeBytes > 0) {
    console.log(
      `[reap-stale-uploads] RECOVER video ${asset.id}  (${asset.originalFileName}, ${stat.sizeBytes} bytes)`
    );
    if (!DRY_RUN) {
      await db.videoAsset.update({
        where: { id: asset.id },
        data: { status: "READY" },
      });
    }
    return "recovered";
  }

  console.log(
    `[reap-stale-uploads] DELETE  video ${asset.id}  (${asset.originalFileName}, no GCS object)`
  );
  if (!DRY_RUN) {
    await db.videoAsset.delete({ where: { id: asset.id } });
  }
  return "deleted";
}

async function reapAudioAsset(asset: {
  id: string;
  objectPath: string;
  originalFileName: string;
}): Promise<Outcome> {
  const stat = await statGcsObject(asset.objectPath);

  if (stat.exists && stat.sizeBytes > 0) {
    console.log(
      `[reap-stale-uploads] RECOVER audio ${asset.id}  (${asset.originalFileName}, ${stat.sizeBytes} bytes)`
    );
    if (!DRY_RUN) {
      await db.audioAsset.update({
        where: { id: asset.id },
        data: { status: "READY" },
      });
      // Recovered audio rows missed the /complete route's after() hook
      // that normally kicks off transcription. runTranscription is
      // contract-bound to never throw — failures persist to the row.
      await runTranscription(asset.id);
    }
    return "recovered";
  }

  console.log(
    `[reap-stale-uploads] DELETE  audio ${asset.id}  (${asset.originalFileName}, no GCS object)`
  );
  if (!DRY_RUN) {
    await db.audioAsset.delete({ where: { id: asset.id } });
  }
  return "deleted";
}

async function main() {
  const cutoff = staleCutoff();
  console.log(
    `[reap-stale-uploads] starting… (DRY_RUN=${DRY_RUN}, STALE_THRESHOLD_HOURS=${STALE_THRESHOLD_HOURS}, MAX_PROCESS=${MAX_PROCESS})`
  );
  console.log(`[reap-stale-uploads] cutoff: ${cutoff.toISOString()}`);

  const [videoCandidates, audioCandidates] = await Promise.all([
    db.videoAsset.findMany({
      where: { status: "UPLOADING", updatedAt: { lt: cutoff } },
      select: {
        id: true,
        objectPath: true,
        originalFileName: true,
      },
      orderBy: { updatedAt: "asc" },
      take: MAX_PROCESS,
    }),
    db.audioAsset.findMany({
      where: { status: "UPLOADING", updatedAt: { lt: cutoff } },
      select: {
        id: true,
        objectPath: true,
        originalFileName: true,
      },
      orderBy: { updatedAt: "asc" },
      take: MAX_PROCESS,
    }),
  ]);

  console.log(
    `[reap-stale-uploads] eligible: ${videoCandidates.length} video, ${audioCandidates.length} audio`
  );

  if (videoCandidates.length === 0 && audioCandidates.length === 0) {
    console.log("[reap-stale-uploads] nothing to do.");
    return;
  }

  let recovered = 0;
  let deleted = 0;

  for (const asset of videoCandidates) {
    const outcome = await reapVideoAsset(asset);
    if (outcome === "recovered") recovered += 1;
    if (outcome === "deleted") deleted += 1;
  }

  for (const asset of audioCandidates) {
    const outcome = await reapAudioAsset(asset);
    if (outcome === "recovered") recovered += 1;
    if (outcome === "deleted") deleted += 1;
  }

  console.log(
    `[reap-stale-uploads] finished. recovered=${recovered} deleted=${deleted}${
      DRY_RUN ? "  (DRY_RUN — no changes written)" : ""
    }`
  );
}

main()
  .catch((err) => {
    console.error("[reap-stale-uploads] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
