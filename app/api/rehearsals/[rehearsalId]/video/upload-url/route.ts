import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";
import {
  buildRehearsalVideoObjectPath,
  createSignedUploadUrl,
} from "@/lib/storage/gcs";

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

type RequestBody = {
  fileName?: string;
  contentType?: string;
  fileSizeBytes?: number;
};

type UploadUrlData = {
  videoAssetId: string;
  uploadUrl: string;
  objectPath: string;
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

type UploadUrlResponse = ApiSuccess<UploadUrlData> | ApiError;

function jsonError(
  status: number,
  code: string,
  message: string
): NextResponse<UploadUrlResponse> {
  return NextResponse.json(
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
): Promise<NextResponse<UploadUrlResponse>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
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

    const body = (await request.json()) as RequestBody;

    const fileName = body.fileName?.trim();
    const contentType = body.contentType?.trim();
    const fileSizeBytes = body.fileSizeBytes;

    if (!fileName) {
      return jsonError(400, "FILE_NAME_REQUIRED", "fileName is required");
    }

    if (!contentType) {
      return jsonError(400, "CONTENT_TYPE_REQUIRED", "contentType is required");
    }

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return jsonError(400, "UNSUPPORTED_VIDEO_TYPE", "Unsupported video type");
    }

    if (
      typeof fileSizeBytes !== "number" ||
      !Number.isFinite(fileSizeBytes) ||
      fileSizeBytes <= 0
    ) {
      return jsonError(
        400,
        "INVALID_FILE_SIZE",
        "fileSizeBytes must be a positive number"
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

    const uploadUrl = await createSignedUploadUrl({
      objectPath,
      contentType,
    });

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
        uploadUrl,
        objectPath,
      },
    });
  } catch (error) {
    console.error("Failed to create upload URL:", error);
    return jsonError(
      500,
      "UPLOAD_URL_CREATE_FAILED",
      error instanceof Error ? error.message : "Failed to create upload URL"
    );
  }
}