import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  CreateNoteRequest,
  CreateNoteResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
) {
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

    if (rehearsal.videoAsset?.status !== "READY") {
      return apiError(
        409,
        "VIDEO_NOT_READY",
        "A ready video is required before adding notes."
      );
    }

    const body = (await request.json()) as Partial<CreateNoteRequest>;

    const bodyText = body.bodyText?.trim();
    const timestampMs = body.timestampMs;

    if (!bodyText) {
      return apiError(400, "BODY_TEXT_REQUIRED", "bodyText is required");
    }

    if (
      typeof timestampMs !== "number" ||
      !Number.isFinite(timestampMs) ||
      timestampMs < 0
    ) {
      return apiError(
        400,
        "INVALID_TIMESTAMP_MS",
        "timestampMs must be a non-negative number"
      );
    }

    const note = await db.note.create({
      data: {
        rehearsalId: rehearsal.id,
        videoAssetId: rehearsal.videoAsset.id,
        authorUserId: dbUser.id,
        bodyText,
        timestampMs: Math.floor(timestampMs),
      },
      include: {
        author: true,
      },
    });

    return NextResponse.json<CreateNoteResponse>({
      ok: true,
      data: {
        note,
      },
    });
  } catch (error) {
    console.error("Failed to create note:", error);

    return apiError(
      500,
      "CREATE_NOTE_FAILED",
      error instanceof Error ? error.message : "Failed to create note"
    );
  }
}