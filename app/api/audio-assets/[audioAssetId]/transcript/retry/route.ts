import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type { TranscriptResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { runTranscription } from "@/lib/transcription/run";

// Same headroom as the complete route — `after()` will run a fresh
// transcription in the same function invocation.
export const maxDuration = 60;

const STAFF_ROLES = ["ADMIN", "INSTRUCTOR", "ASSISTANT"] as const;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ audioAssetId: string }> }
): Promise<NextResponse<TranscriptResponse>> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!dbUser) {
      return apiError(401, "USER_NOT_FOUND", "User not found");
    }

    const { audioAssetId } = await context.params;

    // Staff-gated: the caller must be ADMIN / INSTRUCTOR / ASSISTANT on
    // the team that owns this audio asset. Dancers see "Transcript
    // unavailable" with no retry button and ping their instructor.
    const audioAsset = await db.audioAsset.findFirst({
      where: {
        id: audioAssetId,
        rehearsal: {
          project: {
            team: {
              members: {
                some: {
                  userId: dbUser.id,
                  role: { in: [...STAFF_ROLES] },
                },
              },
            },
          },
        },
      },
      select: { id: true, status: true },
    });

    if (!audioAsset) {
      return apiError(
        404,
        "AUDIO_ASSET_NOT_FOUND",
        "Audio asset not found or you don't have permission to retry"
      );
    }

    if (audioAsset.status !== "READY") {
      return apiError(
        409,
        "AUDIO_NOT_READY",
        "Audio asset upload is not complete"
      );
    }

    const updated = await db.audioAsset.update({
      where: { id: audioAsset.id },
      data: {
        transcriptStatus: "PENDING",
        transcriptError: null,
      },
      select: {
        id: true,
        transcript: true,
        transcriptStatus: true,
        transcriptError: true,
      },
    });

    after(() => runTranscription(updated.id));

    return NextResponse.json({
      ok: true,
      data: {
        audioAssetId: updated.id,
        status: updated.transcriptStatus,
        transcript: updated.transcript,
        transcriptError: updated.transcriptError,
      },
    });
  } catch (error) {
    console.error("Failed to retry transcription:", error);
    return apiError(
      500,
      "TRANSCRIPT_RETRY_FAILED",
      error instanceof Error ? error.message : "Failed to retry transcription"
    );
  }
}
