import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type { TranscriptResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";

export async function GET(
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

    // Visibility matches audio playback: any team member of the owning
    // team can read the transcript. The same chain check the playback URL
    // route uses, so the auth surface stays consistent.
    const audioAsset = await db.audioAsset.findFirst({
      where: {
        id: audioAssetId,
        rehearsal: {
          project: {
            team: {
              members: {
                some: { userId: dbUser.id },
              },
            },
          },
        },
      },
      select: {
        id: true,
        transcript: true,
        transcriptStatus: true,
        transcriptError: true,
      },
    });

    if (!audioAsset) {
      return apiError(
        404,
        "AUDIO_ASSET_NOT_FOUND",
        "Audio asset not found or access denied"
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        audioAssetId: audioAsset.id,
        status: audioAsset.transcriptStatus,
        transcript: audioAsset.transcript,
        transcriptError: audioAsset.transcriptError,
      },
    });
  } catch (error) {
    console.error("Failed to fetch transcript:", error);
    return apiError(
      500,
      "TRANSCRIPT_FETCH_FAILED",
      error instanceof Error ? error.message : "Failed to fetch transcript"
    );
  }
}
