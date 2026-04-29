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

    const videoAsset = rehearsal.videoAsset;

    if (videoAsset?.status !== "READY") {
      return apiError(
        409,
        "VIDEO_NOT_READY",
        "A ready video is required before adding notes."
      );
    }

    const body = (await request.json()) as Partial<CreateNoteRequest>;

    const bodyText = body.bodyText?.trim();
    const timestampMs = body.timestampMs;
    const assigneeUserIds = Array.isArray(body.assigneeUserIds)
      ? [...new Set(body.assigneeUserIds.filter(Boolean))]
      : [];

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

    const teamMemberUserIds = new Set(
      rehearsal.project.team.members.map((member) => member.userId)
    );

    const invalidAssignee = assigneeUserIds.find(
      (assigneeUserId) => !teamMemberUserIds.has(assigneeUserId)
    );

    if (invalidAssignee) {
      return apiError(
        400,
        "INVALID_ASSIGNEE",
        "One or more assignees are not members of this team"
      );
    }

    const note = await db.$transaction(async (tx) => {
      const createdNote = await tx.note.create({
        data: {
          rehearsalId: rehearsal.id,
          videoAssetId: videoAsset.id,
          authorUserId: dbUser.id,
          bodyText,
          timestampMs: Math.floor(timestampMs),
        },
      });

      for (const assigneeUserId of assigneeUserIds) {
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
          assignments: {
            include: {
              user: true,
              status: true,
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