import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type { PlaybackResponse } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";
import { createSignedReadUrl } from "@/lib/storage/gcs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ rehearsalId: string }> }
): Promise<NextResponse<PlaybackResponse>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return apiError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const dbUser = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!dbUser) {
      return apiError(401, "USER_NOT_FOUND", "User not found");
    }

    const { rehearsalId } = await context.params;

    const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);

    if (!rehearsal) {
      return apiError(
        404,
        "REHEARSAL_NOT_FOUND",
        "Rehearsal not found or access denied"
      );
    }

    if (!rehearsal.videoAsset) {
      return apiError(404, "VIDEO_MISSING", "No video uploaded for this rehearsal");
    }

    if (rehearsal.videoAsset.status !== "READY") {
      return apiError(409, "VIDEO_NOT_READY", "Video is not ready for playback");
    }

    const playbackUrl = await createSignedReadUrl(rehearsal.videoAsset.objectPath);

    return NextResponse.json({
      ok: true,
      data: {
        playbackUrl,
        videoAssetId: rehearsal.videoAsset.id,
        mimeType: rehearsal.videoAsset.mimeType,
        originalFileName: rehearsal.videoAsset.originalFileName,
      },
    });
  } catch (error) {
    console.error("Failed to create playback URL:", error);

    return apiError(
      500,
      "PLAYBACK_URL_CREATE_FAILED",
      error instanceof Error ? error.message : "Failed to create playback URL"
    );
  }
}