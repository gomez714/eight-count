import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ videoAssetId: string }> }
): Promise<NextResponse<CompleteUploadResponse>> {
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

    const { videoAssetId } = await context.params;

    const videoAsset = await db.videoAsset.findFirst({
      where: {
        id: videoAssetId,
        rehearsal: {
          project: {
            team: {
              members: {
                some: {
                  userId: dbUser.id,
                },
              },
            },
          },
        },
      },
    });

    if (!videoAsset) {
      return apiError(
        404,
        "VIDEO_ASSET_NOT_FOUND",
        "Video asset not found or access denied"
      );
    }

    const body = (await request
      .json()
      .catch(() => ({}))) as Partial<CompleteUploadRequest>;
    const durationMs = body.durationMs;

    const normalizedDurationMs =
      typeof durationMs === "number" &&
      Number.isFinite(durationMs) &&
      durationMs >= 0
        ? Math.floor(durationMs)
        : null;

    const updatedVideoAsset = await db.videoAsset.update({
      where: {
        id: videoAsset.id,
      },
      data: {
        status: "READY",
        durationMs: normalizedDurationMs,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        videoAssetId: updatedVideoAsset.id,
        status: updatedVideoAsset.status,
      },
    });
  } catch (error) {
    console.error("Failed to complete video upload:", error);

    return apiError(
      500,
      "COMPLETE_UPLOAD_FAILED",
      error instanceof Error ? error.message : "Failed to complete video upload"
    );
  }
}