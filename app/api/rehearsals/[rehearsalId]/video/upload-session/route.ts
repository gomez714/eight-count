import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  UploadSessionRequest,
  UploadSessionResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";
import {
  buildRehearsalVideoObjectPath,
  createResumableUploadSession,
} from "@/lib/storage/gcs";
import { DEFAULT_CHUNK_SIZE } from "@/lib/upload/resumable-uploader";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

const VIDEO_MANAGER_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

// Resumable-upload counterpart to /upload-url. The single-PUT route stays
// in place for any legacy clients, but new uploads should use this one —
// session URIs are valid for 7 days (vs. 1 h for the signed URL) and the
// client uploads in chunks so a network blip kills one chunk instead of
// the whole transfer. See "Video Upload Flow" in CLAUDE.md.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
): Promise<NextResponse<UploadSessionResponse>> {
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

    const callerMembership = rehearsal.project.team.members.find(
      (member) => member.userId === dbUser.id
    );
    if (!callerMembership || !VIDEO_MANAGER_ROLES.has(callerMembership.role)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only admins, instructors, and assistants can upload rehearsal videos."
      );
    }

    const body = (await request.json()) as Partial<UploadSessionRequest>;

    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const fileSizeBytes = body.fileSizeBytes;

    if (!fileName) {
      return apiError(400, "FILE_NAME_REQUIRED", "fileName is required");
    }

    if (!contentType) {
      return apiError(400, "CONTENT_TYPE_REQUIRED", "contentType is required");
    }

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return apiError(400, "UNSUPPORTED_VIDEO_TYPE", "Unsupported video type");
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

    if (fileSizeBytes > MAX_VIDEO_BYTES) {
      return apiError(
        400,
        "VIDEO_TOO_LARGE",
        "Video file exceeds the 2 GB limit"
      );
    }

    const existingVideoAsset = rehearsal.videoAsset;
    const videoAssetId = existingVideoAsset?.id ?? crypto.randomUUID();

    const objectPath = buildRehearsalVideoObjectPath({
      teamId: rehearsal.project.team.id,
      projectId: rehearsal.project.id,
      rehearsalId: rehearsal.id,
      videoAssetId,
      originalFileName: fileName,
    });

    // Forward the browser's Origin so the session URI emits CORS headers
    // on chunk PUTs. Without this, the browser blocks every PUT regardless
    // of bucket-level CORS — bucket CORS doesn't auto-apply to resumable
    // sessions (see "Video Upload Flow" in CLAUDE.md).
    const origin = request.headers.get("origin");
    const sessionUri = await createResumableUploadSession({
      objectPath,
      contentType,
      origin,
    });

    // Same row-shape as the /upload-url path so /complete behaves identically
    // regardless of which upload route was used.
    const videoAsset = existingVideoAsset
      ? await db.videoAsset.update({
          where: { id: existingVideoAsset.id },
          data: {
            bucketName: process.env.GCS_BUCKET_NAME!,
            objectPath,
            originalFileName: fileName,
            mimeType: contentType,
            fileSizeBytes: BigInt(Math.floor(fileSizeBytes)),
            uploadedByUserId: dbUser.id,
            status: "UPLOADING",
            durationMs: null,
          },
        })
      : await db.videoAsset.create({
          data: {
            id: videoAssetId,
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
        videoAssetId: videoAsset.id,
        sessionUri,
        objectPath,
        chunkSize: DEFAULT_CHUNK_SIZE,
      },
    });
  } catch (error) {
    console.error("[upload] failed to create video upload session:", error);
    return apiError(
      500,
      "UPLOAD_SESSION_CREATE_FAILED",
      error instanceof Error
        ? error.message
        : "Failed to create upload session"
    );
  }
}
