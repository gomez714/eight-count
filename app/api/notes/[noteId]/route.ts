import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  DeleteNoteResponse,
  UpdateNoteRequest,
  UpdateNoteResponse,
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

const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

async function loadNoteForAuthor(noteId: string) {
  return db.note.findUnique({
    where: { id: noteId },
    include: {
      assignments: true,
      rehearsal: {
        include: {
          project: {
            include: {
              team: { include: { members: true } },
              groups: {
                include: {
                  members: { include: { teamMember: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
) {
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

    const { noteId } = await context.params;

    const note = await loadNoteForAuthor(noteId);
    if (!note) {
      return apiError(404, "NOTE_NOT_FOUND", "Note not found");
    }

    if (note.authorUserId !== dbUser.id) {
      return apiError(
        403,
        "FORBIDDEN",
        "You can only edit notes you authored."
      );
    }

    // Caller must still be a staff-role member of the team. Catches the
    // case where an author was demoted to DANCER between create and edit.
    const membership = note.rehearsal.project.team.members.find(
      (member) => member.userId === dbUser.id
    );
    if (!membership || !AUTHOR_ROLES.has(membership.role)) {
      return apiError(
        403,
        "FORBIDDEN",
        "You no longer have permission to edit notes on this team."
      );
    }

    const body = (await request.json()) as Partial<
      UpdateNoteRequest & {
        bodyText?: string;
        startTimestampMs?: number;
        endTimestampMs?: number;
      }
    >;

    const startTimestampMs = body.startTimestampMs;

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

    // Tag is optional. Three cases:
    //   - undefined → leave the column untouched (don't include in update data)
    //   - null      → explicitly clear the tag
    //   - valid enum value → set
    let tagUpdate: { tag: NoteTag | null } | undefined;
    if (body.tag === null) {
      tagUpdate = { tag: null };
    } else if (body.tag !== undefined) {
      if (!isNoteTag(body.tag)) {
        return apiError(
          400,
          "INVALID_TAG",
          `tag must be one of: ${NOTE_TAGS.join("|")}`
        );
      }
      tagUpdate = { tag: body.tag };
    }

    let bodyText: string | null = note.bodyText;
    let endTimestampMs: number | null = null;

    if (note.noteType === "VOICE") {
      const candidateEndMs = body.endTimestampMs;
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
      endTimestampMs = Math.floor(candidateEndMs);
    } else {
      const candidateBody = body.bodyText?.trim();
      if (!candidateBody) {
        return apiError(400, "BODY_TEXT_REQUIRED", "bodyText is required");
      }
      bodyText = candidateBody;
    }

    const targets = dedupeTargets(
      normalizeTargets({ targets: body.targets })
    );

    const teamMembers = note.rehearsal.project.team.members;
    const teamMemberUserIds = new Set(
      teamMembers.map((member) => member.userId)
    );

    const userTargetCheck = validateUserTargets(targets, teamMemberUserIds);
    if (!userTargetCheck.ok) {
      return apiError(400, userTargetCheck.code, userTargetCheck.message);
    }

    const projectGroups = note.rehearsal.project.groups;
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

    const newUserIds = resolveTargetsToUserIds(
      targets,
      teamMemberUserIds,
      groupUserIdsByGroupId
    );

    // Diff against the existing assignments. Preserving rows whose userIds
    // remain in the audience keeps each dancer's status (e.g., ADDRESSED)
    // intact across edits.
    const existingAssignments = note.assignments;
    const existingUserIds = new Set(
      existingAssignments.map((assignment) => assignment.userId)
    );

    const userIdsToAdd: string[] = [];
    for (const userId of newUserIds) {
      if (!existingUserIds.has(userId)) userIdsToAdd.push(userId);
    }

    const assignmentIdsToDelete = existingAssignments
      .filter((assignment) => !newUserIds.has(assignment.userId))
      .map((assignment) => assignment.id);

    const updated = await db.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: note.id },
        data: {
          bodyText,
          startTimestampMs: Math.floor(startTimestampMs),
          endTimestampMs,
          ...tagUpdate,
        },
      });

      // Replace target rows wholesale — they hold no per-recipient state.
      await tx.noteTarget.deleteMany({ where: { noteId: note.id } });
      for (const target of targets) {
        await tx.noteTarget.create({
          data: {
            noteId: note.id,
            kind: target.kind,
            userId: target.kind === "USER" ? target.userId : null,
            projectGroupId:
              target.kind === "GROUP" ? target.projectGroupId : null,
          },
        });
      }

      // Cascade on NoteAssignment cleans up each removed assignment's
      // NoteAssignmentStatus row automatically.
      if (assignmentIdsToDelete.length > 0) {
        await tx.noteAssignment.deleteMany({
          where: { id: { in: assignmentIdsToDelete } },
        });
      }

      for (const assigneeUserId of userIdsToAdd) {
        await tx.noteAssignment.create({
          data: {
            noteId: note.id,
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
        where: { id: note.id },
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
            include: { user: true, status: true },
          },
          targets: {
            include: { user: true, group: true },
          },
        },
      });
    });

    return NextResponse.json<UpdateNoteResponse>({
      ok: true,
      data: { note: updated },
    });
  } catch (error) {
    console.error("Failed to update note:", error);
    return apiError(
      500,
      "UPDATE_NOTE_FAILED",
      error instanceof Error ? error.message : "Failed to update note"
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
) {
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

    const { noteId } = await context.params;

    const note = await db.note.findUnique({
      where: { id: noteId },
      select: { id: true, authorUserId: true, audioAssetId: true },
    });
    if (!note) {
      return apiError(404, "NOTE_NOT_FOUND", "Note not found");
    }
    if (note.authorUserId !== dbUser.id) {
      return apiError(
        403,
        "FORBIDDEN",
        "You can only delete notes you authored."
      );
    }

    await db.$transaction(async (tx) => {
      await tx.note.delete({ where: { id: note.id } });
      if (note.audioAssetId) {
        await tx.audioAsset.delete({ where: { id: note.audioAssetId } });
      }
    });

    return NextResponse.json<DeleteNoteResponse>({
      ok: true,
      data: { noteId: note.id },
    });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return apiError(
      500,
      "DELETE_NOTE_FAILED",
      error instanceof Error ? error.message : "Failed to delete note"
    );
  }
}
