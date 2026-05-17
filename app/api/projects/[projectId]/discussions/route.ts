import { NextRequest, NextResponse } from "next/server"

import type {
  CreateDiscussionRequest,
  CreateDiscussionResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { getDiscussionsForProject } from "@/lib/discussions/get-discussions-for-project"
import { getProjectForUser } from "@/lib/projects/get-project-for-user"

const DISCUSSION_BODY_MAX = 4000

/**
 * Create a discussion. Any team member of the project's team can author
 * (including dancers — deliberate departure from Note authoring which
 * is staff-only). The schema is permissive about combinations; this
 * route enforces the integrity rules:
 *
 *   - rehearsalId, when set, must belong to projectId
 *   - videoAssetId, when set, must reference the rehearsal's video
 *     AND rehearsalId must be set
 *   - timestamps may only be non-null when videoAssetId is set
 *   - voice (noteType=VOICE) requires rehearsalId, videoAssetId,
 *     audioAssetId, and both timestamps. Project-level voice is
 *     deliberately not supported in v1 — `AudioAsset.rehearsalId` is
 *     required at the schema level.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const dbUser = await ensureDbUser()
    if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

    const { projectId } = await context.params
    const project = await getProjectForUser(projectId, dbUser.id)
    if (!project) {
      return apiError(
        404,
        "PROJECT_NOT_FOUND",
        "Project not found or access denied"
      )
    }

    const body = (await request.json()) as Partial<
      CreateDiscussionRequest & {
        bodyText?: string
        rehearsalId?: string | null
        videoAssetId?: string | null
        audioAssetId?: string
        startTimestampMs?: number | null
        endTimestampMs?: number | null
      }
    >

    const noteType = body.noteType ?? "TEXT"

    const rehearsalIdInput =
      body.rehearsalId === undefined || body.rehearsalId === null
        ? null
        : String(body.rehearsalId)
    const videoAssetIdInput =
      body.videoAssetId === undefined || body.videoAssetId === null
        ? null
        : String(body.videoAssetId)

    // Cross-entity validation. Resolve rehearsal first (when set) so we
    // can also validate the videoAsset against it in one place.
    let rehearsalId: string | null = null
    let videoAssetId: string | null = null
    let videoIsReady = false

    if (rehearsalIdInput !== null) {
      const rehearsal = await db.rehearsal.findFirst({
        where: { id: rehearsalIdInput, projectId },
        select: {
          id: true,
          videoAsset: { select: { id: true, status: true } },
        },
      })
      if (!rehearsal) {
        return apiError(
          400,
          "REHEARSAL_NOT_IN_PROJECT",
          "rehearsalId must belong to projectId"
        )
      }
      rehearsalId = rehearsal.id

      if (videoAssetIdInput !== null) {
        if (!rehearsal.videoAsset || rehearsal.videoAsset.id !== videoAssetIdInput) {
          return apiError(
            400,
            "VIDEO_ASSET_MISMATCH",
            "videoAssetId must be the rehearsal's video asset"
          )
        }
        videoAssetId = rehearsal.videoAsset.id
        videoIsReady = rehearsal.videoAsset.status === "READY"
      }
    } else if (videoAssetIdInput !== null) {
      return apiError(
        400,
        "VIDEO_ASSET_REQUIRES_REHEARSAL",
        "videoAssetId requires rehearsalId"
      )
    }

    const startTimestampMs =
      typeof body.startTimestampMs === "number" &&
      Number.isFinite(body.startTimestampMs) &&
      body.startTimestampMs >= 0
        ? Math.floor(body.startTimestampMs)
        : null
    const endTimestampMs =
      typeof body.endTimestampMs === "number" &&
      Number.isFinite(body.endTimestampMs) &&
      body.endTimestampMs >= 0
        ? Math.floor(body.endTimestampMs)
        : null

    if ((startTimestampMs !== null || endTimestampMs !== null) && videoAssetId === null) {
      return apiError(
        400,
        "TIMESTAMP_REQUIRES_VIDEO",
        "timestamps require a videoAssetId (and therefore a rehearsal with a video)"
      )
    }
    if (
      startTimestampMs !== null &&
      endTimestampMs !== null &&
      endTimestampMs < startTimestampMs
    ) {
      return apiError(
        400,
        "INVALID_TIMESTAMP_RANGE",
        "endTimestampMs must be >= startTimestampMs"
      )
    }

    let bodyText: string | null = null
    let audioAssetIdToAttach: string | null = null
    const resolvedStartMs = startTimestampMs
    const resolvedEndMs = endTimestampMs

    if (noteType === "VOICE") {
      if (!rehearsalId || !videoAssetId) {
        return apiError(
          400,
          "VOICE_REQUIRES_VIDEO",
          "Voice discussions require a rehearsal with a video"
        )
      }
      if (!videoIsReady) {
        return apiError(
          409,
          "VIDEO_NOT_READY",
          "A ready video is required for voice discussions"
        )
      }
      if (resolvedStartMs === null || resolvedEndMs === null) {
        return apiError(
          400,
          "VOICE_TIMESTAMPS_REQUIRED",
          "Voice discussions require both startTimestampMs and endTimestampMs"
        )
      }

      const candidateAudioAssetId = body.audioAssetId?.trim()
      if (!candidateAudioAssetId) {
        return apiError(
          400,
          "AUDIO_ASSET_REQUIRED",
          "audioAssetId is required for voice discussions"
        )
      }

      const audioAsset = await db.audioAsset.findFirst({
        where: {
          id: candidateAudioAssetId,
          rehearsalId,
          uploadedByUserId: dbUser.id,
          status: "READY",
          note: null,
          discussion: null,
        },
      })
      if (!audioAsset) {
        return apiError(
          400,
          "AUDIO_ASSET_NOT_AVAILABLE",
          "Audio asset not found, not ready, or already attached"
        )
      }

      audioAssetIdToAttach = audioAsset.id
    } else {
      const candidateBody = body.bodyText?.trim()
      if (!candidateBody) {
        return apiError(400, "BODY_TEXT_REQUIRED", "bodyText is required")
      }
      if (candidateBody.length > DISCUSSION_BODY_MAX) {
        return apiError(
          400,
          "BODY_TEXT_TOO_LONG",
          `bodyText must be ${DISCUSSION_BODY_MAX} characters or fewer`
        )
      }
      bodyText = candidateBody
    }

    const discussion = await db.discussion.create({
      data: {
        projectId,
        rehearsalId,
        videoAssetId,
        authorUserId: dbUser.id,
        noteType,
        bodyText,
        startTimestampMs: resolvedStartMs,
        endTimestampMs: resolvedEndMs,
        audioAssetId: audioAssetIdToAttach,
      },
      include: {
        author: true,
        audioAsset: {
          select: {
            id: true,
            mimeType: true,
            durationMs: true,
            status: true,
          },
        },
        rehearsal: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json<CreateDiscussionResponse>({
      ok: true,
      data: { discussion },
    })
  } catch (error) {
    console.error("[discussions] Failed to create discussion:", error)
    return apiError(
      500,
      "CREATE_DISCUSSION_FAILED",
      error instanceof Error ? error.message : "Failed to create discussion"
    )
  }
}

/**
 * List all discussions for a project — both project-level
 * (`rehearsalId IS NULL`) and rehearsal-anchored ones rolled up.
 * Capped at 50 in v1 (see `getDiscussionsForProject`).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { projectId } = await context.params
  const project = await getProjectForUser(projectId, dbUser.id)
  if (!project) {
    return apiError(
      404,
      "PROJECT_NOT_FOUND",
      "Project not found or access denied"
    )
  }

  const discussions = await getDiscussionsForProject(projectId, dbUser.id)
  return NextResponse.json({ ok: true, data: { discussions } })
}
