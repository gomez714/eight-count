/**
 * Transcription orchestrator. Called from `after()` in the audio-complete
 * route and from the staff retry endpoint.
 *
 * Contract: never throws. All errors are persisted to the AudioAsset row
 * as `transcriptStatus = FAILED` + `transcriptError` so the UI can surface
 * a retry affordance.
 */

import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage/gcs";

import { TranscriptionError, transcribeFromUrl } from "./deepgram";

export async function runTranscription(audioAssetId: string): Promise<void> {
  try {
    const asset = await db.audioAsset.findUnique({
      where: { id: audioAssetId },
      select: { id: true, objectPath: true, status: true },
    });

    if (!asset) {
      console.error(
        `[transcription] AudioAsset ${audioAssetId} not found; skipping.`
      );
      return;
    }

    if (asset.status !== "READY") {
      console.error(
        `[transcription] AudioAsset ${audioAssetId} is ${asset.status}, not READY; skipping.`
      );
      return;
    }

    await db.audioAsset.update({
      where: { id: audioAssetId },
      data: { transcriptStatus: "PROCESSING", transcriptError: null },
    });

    const signedUrl = await createSignedReadUrl(asset.objectPath);
    const { transcript } = await transcribeFromUrl({ signedUrl });

    await db.audioAsset.update({
      where: { id: audioAssetId },
      data: {
        transcript,
        transcriptStatus: "READY",
        transcriptError: null,
        transcribedAt: new Date(),
      },
    });
  } catch (error) {
    const message =
      error instanceof TranscriptionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown transcription error";

    console.error(
      `[transcription] Failed for AudioAsset ${audioAssetId}: ${message}`
    );

    try {
      await db.audioAsset.update({
        where: { id: audioAssetId },
        data: {
          transcriptStatus: "FAILED",
          transcriptError: message.slice(0, 500),
        },
      });
    } catch (writeError) {
      // If we can't even write the failure state, just log and move on —
      // throwing here would crash the `after()` callback for no benefit.
      console.error(
        `[transcription] Could not persist FAILED state for ${audioAssetId}:`,
        writeError
      );
    }
  }
}
