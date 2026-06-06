import { NextRequest, NextResponse } from "next/server"

import type {
  DeleteDiscussionResponse,
  UpdateDiscussionRequest,
  UpdateDiscussionResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { getDiscussionForUser } from "@/lib/discussions/get-discussion-for-user"

const DISCUSSION_BODY_MAX = 4000

/**
 * Edit a discussion. Author-only.
 *
 * - TEXT discussions: bodyText is required; timestamps may be updated
 *   (only if videoAssetId is set on the existing row — i.e. the
 *   discussion is anchored).
 * - VOICE discussions: only timestamps may be updated. Replacing the
 *   audio = delete + create new (same as Note voice).
 *
 * Tag editing is deferred to v1.5; not in the request shape.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ discussionId: string }> }
) {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId } = await context.params
  const discussion = await getDiscussionForUser(discussionId, dbUser.id)
  if (!discussion) {
    return apiError(
      404,
      "DISCUSSION_NOT_FOUND",
      "Discussion not found or access denied"
    )
  }
  if (discussion.authorUserId !== dbUser.id) {
    return apiError(
      403,
      "FORBIDDEN",
      "You can only edit your own discussions."
    )
  }

  let body: UpdateDiscussionRequest
  try {
    body = (await request.json()) as UpdateDiscussionRequest
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.")
  }

  const isAnchored = discussion.videoAssetId !== null

  // Timestamp helpers — used by both TEXT and VOICE branches.
  const parseTimestamp = (
    value: number | null | undefined
  ): number | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (!Number.isFinite(value) || value < 0) {
      return undefined // signal "invalid"; caller decides
    }
    return Math.floor(value)
  }

  if (discussion.noteType === "VOICE") {
    if (body.noteType !== undefined && body.noteType !== "VOICE") {
      return apiError(
        400,
        "NOTE_TYPE_IMMUTABLE",
        "Cannot change a voice discussion's type."
      )
    }
    const startMs = parseTimestamp(body.startTimestampMs)
    const endMs = parseTimestamp(body.endTimestampMs)

    // Voice timestamps are a coordinated pair. Three valid request
    // shapes (matches Note PATCH semantics):
    //   undefined + undefined → leave both alone
    //   null + null           → un-anchor (clear both)
    //   number + number       → set both (end >= start). Only valid if
    //                           the discussion is video-anchored.
    let voiceData: { startTimestampMs?: number | null; endTimestampMs?: number | null } = {}
    if (startMs === undefined && endMs === undefined) {
      // No-op — leave both alone.
    } else if (startMs === null && endMs === null) {
      voiceData = { startTimestampMs: null, endTimestampMs: null }
    } else if (typeof startMs === "number" && typeof endMs === "number") {
      if (discussion.videoAssetId === null) {
        return apiError(
          400,
          "TIMESTAMP_REQUIRES_VIDEO",
          "Cannot anchor a video-less voice discussion via PATCH"
        )
      }
      if (endMs < startMs) {
        return apiError(
          400,
          "INVALID_TIMESTAMP_RANGE",
          "endTimestampMs must be >= startTimestampMs"
        )
      }
      voiceData = { startTimestampMs: startMs, endTimestampMs: endMs }
    } else {
      return apiError(
        400,
        "INVALID_TIMESTAMP_PAIR",
        "Voice timestamps must be sent as a pair (both numbers, both null, or both omitted)"
      )
    }

    const updated = await db.discussion.update({
      where: { id: discussionId },
      data: voiceData,
    })
    return NextResponse.json<UpdateDiscussionResponse>({
      ok: true,
      data: { discussion: updated },
    })
  }

  // TEXT branch.
  if (body.noteType !== undefined && body.noteType !== "TEXT") {
    return apiError(
      400,
      "NOTE_TYPE_IMMUTABLE",
      "Cannot change a text discussion's type."
    )
  }
  const candidateBody =
    typeof body.bodyText === "string" ? body.bodyText.trim() : ""
  if (candidateBody.length === 0) {
    return apiError(400, "BODY_TEXT_REQUIRED", "bodyText is required")
  }
  if (candidateBody.length > DISCUSSION_BODY_MAX) {
    return apiError(
      400,
      "BODY_TEXT_TOO_LONG",
      `bodyText must be ${DISCUSSION_BODY_MAX} characters or fewer`
    )
  }

  const startMs = parseTimestamp(body.startTimestampMs)
  const endMs = parseTimestamp(body.endTimestampMs)

  // Reject timestamp updates on un-anchored discussions — they have no
  // video to anchor to. Author would need to delete + recreate to
  // anchor an existing un-anchored discussion (deferred).
  if (!isAnchored && (startMs !== undefined || endMs !== undefined)) {
    if (startMs !== null || endMs !== null) {
      return apiError(
        400,
        "TIMESTAMP_REQUIRES_VIDEO",
        "Cannot anchor a project-level discussion via PATCH"
      )
    }
  }
  if (
    typeof startMs === "number" &&
    typeof endMs === "number" &&
    endMs < startMs
  ) {
    return apiError(
      400,
      "INVALID_TIMESTAMP_RANGE",
      "endTimestampMs must be >= startTimestampMs"
    )
  }

  const updated = await db.discussion.update({
    where: { id: discussionId },
    data: {
      bodyText: candidateBody,
      // `undefined` = leave untouched; `null` = clear; number = set.
      ...(startMs !== undefined && { startTimestampMs: startMs }),
      ...(endMs !== undefined && { endTimestampMs: endMs }),
    },
  })
  return NextResponse.json<UpdateDiscussionResponse>({
    ok: true,
    data: { discussion: updated },
  })
}

/**
 * Delete a discussion. Author-only. Cascade-deletes comments,
 * reactions, and thread views via FK. For voice, also deletes the
 * linked AudioAsset row (matches Note delete behavior).
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ discussionId: string }> }
) {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId } = await context.params
  const discussion = await getDiscussionForUser(discussionId, dbUser.id)
  if (!discussion) {
    return apiError(
      404,
      "DISCUSSION_NOT_FOUND",
      "Discussion not found or access denied"
    )
  }
  if (discussion.authorUserId !== dbUser.id) {
    return apiError(
      403,
      "FORBIDDEN",
      "You can only delete your own discussions."
    )
  }

  const linkedAudioAssetId = discussion.audioAssetId

  await db.$transaction(async (tx) => {
    await tx.discussion.delete({ where: { id: discussionId } })
    if (linkedAudioAssetId) {
      await tx.audioAsset.delete({ where: { id: linkedAudioAssetId } })
    }
  })

  return NextResponse.json<DeleteDiscussionResponse>({
    ok: true,
    data: { discussionId },
  })
}
