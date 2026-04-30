import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import type {
  CreateNoteRequest,
  CreateNoteResponse,
  NoteTargetInput,
} from "@/lib/api/contracts";
import { apiError } from "@/lib/api/responses";
import { db } from "@/lib/db";
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user";

type NormalizedTarget =
  | { kind: "EVERYONE" }
  | { kind: "USER"; userId: string }
  | { kind: "GROUP"; projectGroupId: string };

function parseTarget(target: NoteTargetInput): NormalizedTarget | null {
  if (!target || typeof target !== "object") return null;

  if (target.kind === "EVERYONE") {
    return { kind: "EVERYONE" };
  }

  if (target.kind === "USER" && typeof target.userId === "string") {
    return { kind: "USER", userId: target.userId };
  }

  if (
    target.kind === "GROUP" &&
    typeof target.projectGroupId === "string"
  ) {
    return { kind: "GROUP", projectGroupId: target.projectGroupId };
  }

  return null;
}

function normalizeTargets(body: Partial<CreateNoteRequest>): NormalizedTarget[] {
  const out: NormalizedTarget[] = [];

  if (Array.isArray(body.targets)) {
    for (const target of body.targets) {
      const parsed = parseTarget(target);
      if (parsed) out.push(parsed);
    }
  }

  // Back-compat: legacy `assigneeUserIds` becomes USER targets.
  const legacy = body.assigneeUserIds;
  if (Array.isArray(legacy)) {
    for (const userId of legacy) {
      if (typeof userId === "string" && userId) {
        out.push({ kind: "USER", userId });
      }
    }
  }

  return out;
}

function targetKey(target: NormalizedTarget): string {
  if (target.kind === "EVERYONE") return "EVERYONE";
  if (target.kind === "USER") return `USER:${target.userId}`;
  return `GROUP:${target.projectGroupId}`;
}

function dedupeTargets(targets: NormalizedTarget[]): NormalizedTarget[] {
  const seen = new Set<string>();
  const out: NormalizedTarget[] = [];
  for (const target of targets) {
    const key = targetKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

function resolveTargetsToUserIds(
  targets: NormalizedTarget[],
  teamMemberUserIds: Set<string>,
  groupUserIdsByGroupId: Map<string, string[]>
): Set<string> {
  const resolved = new Set<string>();
  for (const target of targets) {
    if (target.kind === "EVERYONE") {
      for (const userId of teamMemberUserIds) resolved.add(userId);
    } else if (target.kind === "USER") {
      resolved.add(target.userId);
    } else {
      const memberUserIds = groupUserIdsByGroupId.get(target.projectGroupId);
      if (memberUserIds) {
        for (const userId of memberUserIds) resolved.add(userId);
      }
    }
  }
  return resolved;
}

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

    const body = (await request.json()) as Partial<CreateNoteRequest>;

    const bodyText = body.bodyText?.trim();
    const timestampMs = body.timestampMs;

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

    const targets = dedupeTargets(normalizeTargets(body));

    const teamMembers = rehearsal.project.team.members;
    const teamMemberUserIds = new Set(
      teamMembers.map((member) => member.userId)
    );

    // Validate USER targets are members of this team.
    const invalidUserTarget = targets.find(
      (target) =>
        target.kind === "USER" && !teamMemberUserIds.has(target.userId)
    );
    if (invalidUserTarget) {
      return apiError(
        400,
        "INVALID_ASSIGNEE",
        "One or more assignees are not members of this team"
      );
    }

    // Validate GROUP targets belong to this rehearsal's project, then build
    // a lookup of resolved user IDs per group for fan-out.
    const projectGroups = rehearsal.project.groups;
    const groupIdsForProject = new Set(
      projectGroups.map((group) => group.id)
    );
    const invalidGroupTarget = targets.find(
      (target) =>
        target.kind === "GROUP" &&
        !groupIdsForProject.has(target.projectGroupId)
    );
    if (invalidGroupTarget) {
      return apiError(
        400,
        "INVALID_GROUP",
        "One or more groups don't belong to this project"
      );
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
          bodyText,
          timestampMs: Math.floor(timestampMs),
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
