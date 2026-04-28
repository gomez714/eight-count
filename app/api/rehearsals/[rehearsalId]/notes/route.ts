import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

type RequestBody = {
  bodyText?: string;
  timestampMs?: number;
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

type CreateNoteResponse = ApiSuccess<{ note: unknown }> | ApiError;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json<CreateNoteResponse>(
    {
      ok: false,
      error: { code, message },
    },
    { status }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
) {
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

    if (rehearsal.videoAsset?.status !== "READY") {
      return jsonError(
        409,
        "VIDEO_NOT_READY",
        "A ready video is required before adding notes."
      );
    }

    const body = (await request.json()) as RequestBody;

    const bodyText = body.bodyText?.trim();
    const timestampMs = body.timestampMs;

    if (!bodyText) {
      return jsonError(400, "BODY_TEXT_REQUIRED", "bodyText is required");
    }

    if (
      typeof timestampMs !== "number" ||
      !Number.isFinite(timestampMs) ||
      timestampMs < 0
    ) {
      return jsonError(
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

    return jsonError(
      500,
      "CREATE_NOTE_FAILED",
      error instanceof Error ? error.message : "Failed to create note"
    );
  }
}