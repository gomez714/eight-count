import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  AudioCompleteUploadRequest,
  AudioCompleteUploadResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ audioAssetId: string }> }
): Promise<NextResponse<AudioCompleteUploadResponse>> {
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

    // Uploader-only: the user who initiated the upload (gated on
    // AUTHOR_ROLES at upload-url time) is the only one allowed to flip
    // status -> READY and persist durationMs. Without this, any team
    // member who learned the asset id could overwrite the row.
    const audioAsset = await db.audioAsset.findFirst({
      where: {
        id: audioAssetId,
        uploadedByUserId: dbUser.id,
      },
    });

    if (!audioAsset) {
      return apiError(
        404,
        "AUDIO_ASSET_NOT_FOUND",
        "Audio asset not found or you didn't initiate this upload"
      );
    }

    const body = (await request.json()) as Partial<AudioCompleteUploadRequest>;
    let durationMs: number | null = null;

    if (body.durationMs !== undefined && body.durationMs !== null) {
      if (
        typeof body.durationMs !== "number" ||
        !Number.isFinite(body.durationMs) ||
        body.durationMs < 0
      ) {
        return apiError(
          400,
          "INVALID_DURATION_MS",
          "durationMs must be a non-negative number"
        );
      }
      durationMs = Math.floor(body.durationMs);
    }

    const updated = await db.audioAsset.update({
      where: { id: audioAsset.id },
      data: {
        status: "READY",
        durationMs,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        audioAssetId: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Failed to complete audio upload:", error);
    return apiError(
      500,
      "AUDIO_COMPLETE_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to complete audio upload"
    );
  }
}
