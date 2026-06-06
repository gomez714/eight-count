import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  CreateNoteRequest,
  CreateNoteResponse,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import {
  dedupeTargets,
  normalizeTargets,
  resolveTargetsToUserIds,
  validateGroupTargets,
  validateUserTargets,
} from "@/lib/notes/resolve-targets";
import { isNoteTag, NOTE_TAGS, type NoteTag } from "@/lib/notes/tags";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

type RawNoteBody = Partial<
  CreateNoteRequest & {
    bodyText?: string;
    startTimestampMs?: number | null;
    endTimestampMs?: number | null;
    audioAssetId?: string;
    noteType?: "TEXT" | "VOICE";
  }
>;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; message: string };

function parseTag(body: RawNoteBody): ValidationResult<NoteTag | null> {
  if (body.tag === undefined || body.tag === null) {
    return { ok: true, value: null };
  }
  if (!isNoteTag(body.tag)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_TAG",
      message: `tag must be one of: ${NOTE_TAGS.join("|")}`,
    };
  }
  return { ok: true, value: body.tag };
}

/**
 * Parse the optional start timestamp against the rehearsal's video state.
 * - Absent / null → un-anchored note (returns `null`).
 * - Number → must be a non-negative finite number, AND the rehearsal must
 *   have a ready video. Returns the floored value.
 */
function parseStartTimestamp(
  body: RawNoteBody,
  videoIsReady: boolean
): ValidationResult<number | null> {
  const raw = body.startTimestampMs;
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_START_TIMESTAMP_MS",
      message: "startTimestampMs must be a non-negative number",
    };
  }
  if (!videoIsReady) {
    return {
      ok: false,
      status: 400,
      code: "TIMESTAMP_REQUIRES_VIDEO",
      message: "A ready video is required to anchor a note to a timestamp.",
    };
  }
  return { ok: true, value: Math.floor(raw) };
}

/**
 * Voice timestamps come as a pair — both or neither. With a video they
 * anchor the recording window against video time; without a video the
 * audio plays standalone and both are null.
 */
function parseVoiceEndTimestamp(
  body: RawNoteBody,
  startTimestampMs: number | null
): ValidationResult<number | null> {
  const candidate = body.endTimestampMs;
  if (startTimestampMs === null) {
    if (candidate !== undefined && candidate !== null) {
      return {
        ok: false,
        status: 400,
        code: "END_TIMESTAMP_WITHOUT_START",
        message: "endTimestampMs requires startTimestampMs",
      };
    }
    return { ok: true, value: null };
  }
  if (
    typeof candidate !== "number" ||
    !Number.isFinite(candidate) ||
    candidate < startTimestampMs
  ) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_END_TIMESTAMP_MS",
      message: "endTimestampMs must be a number >= startTimestampMs",
    };
  }
  return { ok: true, value: Math.floor(candidate) };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError(401, "UNAUTHORIZED", "Unauthorized");

    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!dbUser) return apiError(401, "USER_NOT_FOUND", "User not found");

    const { rehearsalId } = await context.params;
    const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id);
    if (!rehearsal) {
      return apiError(
        404,
        "REHEARSAL_NOT_FOUND",
        "Rehearsal not found or access denied"
      );
    }

    // Gate note authoring to staff-like roles. Dancers can address their
    // own notes (see /my-notes) but cannot author new ones.
    const callerMembership = rehearsal.project.team.members.find(
      (member) => member.userId === dbUser.id
    );
    if (!callerMembership || !AUTHOR_ROLES.has(callerMembership.role)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only admins, instructors, and assistants can add notes."
      );
    }

    const body = (await request.json()) as RawNoteBody;
    const noteType = body.noteType ?? "TEXT";
    const videoAsset = rehearsal.videoAsset;
    const videoIsReady = videoAsset?.status === "READY";

    const tagResult = parseTag(body);
    if (!tagResult.ok) {
      return apiError(tagResult.status, tagResult.code, tagResult.message);
    }
    const tag = tagResult.value;

    const startResult = parseStartTimestamp(body, videoIsReady);
    if (!startResult.ok) {
      return apiError(startResult.status, startResult.code, startResult.message);
    }
    const startTimestampMs = startResult.value;

    let bodyText: string | null = null;
    let audioAssetIdToAttach: string | null = null;
    let endTimestampMs: number | null = null;

    if (noteType === "VOICE") {
      const candidateAudioAssetId = body.audioAssetId?.trim();
      if (!candidateAudioAssetId) {
        return apiError(
          400,
          "AUDIO_ASSET_REQUIRED",
          "audioAssetId is required for voice notes"
        );
      }

      const endResult = parseVoiceEndTimestamp(body, startTimestampMs);
      if (!endResult.ok) {
        return apiError(endResult.status, endResult.code, endResult.message);
      }
      endTimestampMs = endResult.value;

      const audioAsset = await db.audioAsset.findFirst({
        where: {
          id: candidateAudioAssetId,
          rehearsalId: rehearsal.id,
          uploadedByUserId: dbUser.id,
          status: "READY",
          note: null,
        },
      });
      if (!audioAsset) {
        return apiError(
          400,
          "AUDIO_ASSET_NOT_AVAILABLE",
          "Audio asset not found, not ready, or already attached to a note"
        );
      }
      audioAssetIdToAttach = audioAsset.id;
    } else {
      const candidateBody = body.bodyText?.trim();
      if (!candidateBody) {
        return apiError(400, "BODY_TEXT_REQUIRED", "bodyText is required");
      }
      bodyText = candidateBody;
    }

    const targets = dedupeTargets(normalizeTargets(body));
    const teamMembers = rehearsal.project.team.members;
    const teamMemberUserIds = new Set(
      teamMembers.map((member) => member.userId)
    );

    const userTargetCheck = validateUserTargets(targets, teamMemberUserIds);
    if (!userTargetCheck.ok) {
      return apiError(400, userTargetCheck.code, userTargetCheck.message);
    }

    const projectGroups = rehearsal.project.groups;
    const groupIdsForProject = new Set(
      projectGroups.map((group) => group.id)
    );

    const groupTargetCheck = validateGroupTargets(targets, groupIdsForProject);
    if (!groupTargetCheck.ok) {
      return apiError(400, groupTargetCheck.code, groupTargetCheck.message);
    }

    const groupUserIdsByGroupId = new Map<string, string[]>(
      projectGroups.map((group) => [
        group.id,
        group.members
          .map((member) => member.teamMember.userId)
          .filter((userId) => teamMemberUserIds.has(userId)),
      ])
    );

    const resolvedUserIds = resolveTargetsToUserIds(
      targets,
      teamMemberUserIds,
      groupUserIdsByGroupId
    );

    // Persist videoAssetId only when the video is ready — anchored notes
    // already passed the timestamp validation above, so this links them to
    // the right asset. Un-anchored notes (no video yet, or mid-upload)
    // store null and surface in the "Notes without anchor" group.
    const videoAssetIdToAttach = videoIsReady ? videoAsset?.id ?? null : null;

    const note = await db.$transaction(async (tx) => {
      const createdNote = await tx.note.create({
        data: {
          rehearsalId: rehearsal.id,
          videoAssetId: videoAssetIdToAttach,
          authorUserId: dbUser.id,
          noteType,
          bodyText,
          startTimestampMs,
          endTimestampMs,
          audioAssetId: audioAssetIdToAttach,
          tag,
        },
      });

      // Persist the original audience intent as NoteTarget rows.
      for (const target of targets) {
        await tx.noteTarget.create({
          data: {
            noteId: createdNote.id,
            kind: target.kind,
            userId: target.kind === "USER" ? target.userId : null,
            projectGroupId:
              target.kind === "GROUP" ? target.projectGroupId : null,
          },
        });
      }

      // Fan out to per-user NoteAssignment rows for the per-recipient
      // status lifecycle.
      for (const assigneeUserId of resolvedUserIds) {
        await tx.noteAssignment.create({
          data: {
            noteId: createdNote.id,
            userId: assigneeUserId,
            status: {
              create: {
                status: "OPEN",
                updatedByUserId: dbUser.id,
              },
            },
          },
        });
      }

      return tx.note.findUniqueOrThrow({
        where: {
          id: createdNote.id,
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
          assignments: {
            include: {
              user: true,
              status: true,
            },
          },
          targets: {
            include: {
              user: true,
              group: true,
            },
          },
        },
      });
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
