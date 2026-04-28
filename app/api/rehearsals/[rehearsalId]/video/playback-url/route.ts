import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";
import { createSignedReadUrl } from "@/lib/storage/gcs";

type PlaybackData = {
  playbackUrl: string;
  videoAssetId: string;
  mimeType: string;
  originalFileName: string;
};

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type PlaybackResponse = ApiSuccess<PlaybackData> | ApiError;

function jsonError(
  status: number,
  code: string,
  message: string
): NextResponse<PlaybackResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status }
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ rehearsalId: string }> }
): Promise<NextResponse<PlaybackResponse>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const dbUser = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!dbUser) {
      return jsonError(401, "USER_NOT_FOUND", "User not found");
    }

    const { rehearsalId } = await context.params;

    const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);

    if (!rehearsal) {
      return jsonError(
        404,
        "REHEARSAL_NOT_FOUND",
        "Rehearsal not found or access denied"
      );
    }

    if (!rehearsal.videoAsset) {
      return jsonError(404, "VIDEO_MISSING", "No video uploaded for this rehearsal");
    }

    if (rehearsal.videoAsset.status !== "READY") {
      return jsonError(409, "VIDEO_NOT_READY", "Video is not ready for playback");
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

    return jsonError(
      500,
      "PLAYBACK_URL_CREATE_FAILED",
      error instanceof Error ? error.message : "Failed to create playback URL"
    );
  }
}