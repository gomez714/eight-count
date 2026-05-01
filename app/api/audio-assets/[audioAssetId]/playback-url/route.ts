import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type { AudioPlaybackResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { createSignedReadUrl } from "@/lib/storage/gcs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ audioAssetId: string }> }
): Promise<NextResponse<AudioPlaybackResponse>> {
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
    });

    if (!audioAsset) {
      return apiError(
        404,
        "AUDIO_ASSET_NOT_FOUND",
        "Audio asset not found or access denied"
      );
    }

    if (audioAsset.status !== "READY") {
      return apiError(
        409,
        "AUDIO_NOT_READY",
        "Audio asset is not ready for playback"
      );
    }

    const playbackUrl = await createSignedReadUrl(audioAsset.objectPath);

    return NextResponse.json({
      ok: true,
      data: {
        playbackUrl,
        audioAssetId: audioAsset.id,
        mimeType: audioAsset.mimeType,
        durationMs: audioAsset.durationMs,
      },
    });
  } catch (error) {
    console.error("Failed to create audio playback URL:", error);
    return apiError(
      500,
      "AUDIO_PLAYBACK_URL_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to create audio playback URL"
    );
  }
}
