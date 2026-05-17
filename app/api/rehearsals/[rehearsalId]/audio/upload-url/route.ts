import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  AudioUploadUrlRequest,
  AudioUploadUrlResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";
import {
  buildRehearsalAudioObjectPath,
  createSignedUploadUrl,
} from "@/lib/storage/gcs";

const ALLOWED_AUDIO_BASE_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
]);

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

function baseMimeType(contentType: string): string {
  const idx = contentType.indexOf(";");
  return (idx === -1 ? contentType : contentType.slice(0, idx)).trim().toLowerCase();
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
): Promise<NextResponse<AudioUploadUrlResponse>> {
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

    const { rehearsalId } = await context.params;
    const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);
    if (!rehearsal) {
      return apiError(
        404,
        "REHEARSAL_NOT_FOUND",
        "Rehearsal not found or access denied"
      );
    }

    // Role gate depends on intent. Voice *notes* are staff-only (matches
    // the note authoring rule); voice *discussions* are open to all team
    // members (matches the discussion authoring rule). The caller signals
    // intent via `?purpose=discussion`; absence or any other value falls
    // back to the note rule.
    const purpose = request.nextUrl.searchParams.get("purpose");
    const isDiscussionPurpose = purpose === "discussion";

    const callerMembership = rehearsal.project.team.members.find(
      (member) => member.userId === dbUser.id
    );
    if (!callerMembership) {
      return apiError(
        403,
        "FORBIDDEN",
        "You are not a member of this team."
      );
    }
    if (!isDiscussionPurpose && !AUTHOR_ROLES.has(callerMembership.role)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only admins, instructors, and assistants can record voice notes."
      );
    }

    const body = (await request.json()) as Partial<AudioUploadUrlRequest>;

    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const fileSizeBytes = body.fileSizeBytes;

    if (!fileName) {
      return apiError(400, "FILE_NAME_REQUIRED", "fileName is required");
    }
    if (!contentType) {
      return apiError(400, "CONTENT_TYPE_REQUIRED", "contentType is required");
    }
    if (!ALLOWED_AUDIO_BASE_TYPES.has(baseMimeType(contentType))) {
      return apiError(400, "UNSUPPORTED_AUDIO_TYPE", "Unsupported audio type");
    }
    if (
      typeof fileSizeBytes !== "number" ||
      !Number.isFinite(fileSizeBytes) ||
      fileSizeBytes <= 0
    ) {
      return apiError(
        400,
        "INVALID_FILE_SIZE",
        "fileSizeBytes must be a positive number"
      );
    }
    if (fileSizeBytes > MAX_AUDIO_BYTES) {
      return apiError(
        400,
        "AUDIO_TOO_LARGE",
        "Audio file exceeds the 25 MB limit"
      );
    }

    const audioAssetId = crypto.randomUUID();
    const objectPath = buildRehearsalAudioObjectPath({
      teamId: rehearsal.project.team.id,
      projectId: rehearsal.project.id,
      rehearsalId: rehearsal.id,
      audioAssetId,
      originalFileName: fileName,
    });

    const uploadUrl = await createSignedUploadUrl({
      objectPath,
      contentType,
    });

    const audioAsset = await db.audioAsset.create({
      data: {
        id: audioAssetId,
        rehearsalId: rehearsal.id,
        bucketName: process.env.GCS_BUCKET_NAME!,
        objectPath,
        originalFileName: fileName,
        mimeType: contentType,
        fileSizeBytes: BigInt(Math.floor(fileSizeBytes)),
        uploadedByUserId: dbUser.id,
        status: "UPLOADING",
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        audioAssetId: audioAsset.id,
        uploadUrl,
        objectPath,
      },
    });
  } catch (error) {
    console.error("Failed to create audio upload URL:", error);
    return apiError(
      500,
      "AUDIO_UPLOAD_URL_CREATE_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to create audio upload URL"
    );
  }
}
