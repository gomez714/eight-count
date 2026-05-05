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

    // Gate note authoring to staff-like roles. Dancers can address their
    // own notes (see /my-notes) but cannot author new ones.
    const callerMembership = rehearsal.project.team.members.find(
      (member) => member.userId === dbUser.id
    );
    const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);
    if (!callerMembership || !AUTHOR_ROLES.has(callerMembership.role)) {
      return apiError(
        403,
        "FORBIDDEN",
        "Only admins, instructors, and assistants can add notes."
      );
    }

    const videoAsset = rehearsal.videoAsset;

    if (videoAsset?.status !== "READY") {
      return apiError(
        409,
        "VIDEO_NOT_READY",
        "A ready video is required before adding notes."
      );
    }

    const body = (await request.json()) as Partial<
      CreateNoteRequest & {
        bodyText?: string;
        startTimestampMs?: number;
        endTimestampMs?: number;
        audioAssetId?: string;
        noteType?: "TEXT" | "VOICE";
      }
    >;

    const noteType = body.noteType ?? "TEXT";
    const startTimestampMs = body.startTimestampMs;

    let tag: NoteTag | null = null;
    if (body.tag !== undefined && body.tag !== null) {
      if (!isNoteTag(body.tag)) {
        return apiError(
          400,
          "INVALID_TAG",
          `tag must be one of: ${NOTE_TAGS.join("|")}`
        );
      }
      tag = body.tag;
    }

    if (
      typeof startTimestampMs !== "number" ||
      !Number.isFinite(startTimestampMs) ||
      startTimestampMs < 0
    ) {
      return apiError(
        400,
        "INVALID_START_TIMESTAMP_MS",
        "startTimestampMs must be a non-negative number"
      );
    }

    let bodyText: string | null = null;
    let audioAssetIdToAttach: string | null = null;
    let endTimestampMs: number | null = null;

    if (noteType === "VOICE") {
      const candidateAudioAssetId = body.audioAssetId?.trim();
      const candidateEndMs = body.endTimestampMs;

      if (!candidateAudioAssetId) {
        return apiError(
          400,
          "AUDIO_ASSET_REQUIRED",
          "audioAssetId is required for voice notes"
        );
      }

      if (
        typeof candidateEndMs !== "number" ||
        !Number.isFinite(candidateEndMs) ||
        candidateEndMs < startTimestampMs
      ) {
        return apiError(
          400,
          "INVALID_END_TIMESTAMP_MS",
          "endTimestampMs must be a number >= startTimestampMs"
        );
      }

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
      endTimestampMs = Math.floor(candidateEndMs);
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

    const note = await db.$transaction(async (tx) => {
      const createdNote = await tx.note.create({
        data: {
          rehearsalId: rehearsal.id,
          videoAssetId: videoAsset.id,
          authorUserId: dbUser.id,
          noteType,
          bodyText,
          startTimestampMs: Math.floor(startTimestampMs),
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
