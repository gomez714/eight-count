import type { NoteTargetInput } from "@/lib/api/contracts";

export type NormalizedTarget =
  | { kind: "EVERYONE" }
  | { kind: "USER"; userId: string }
  | { kind: "GROUP"; projectGroupId: string };

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

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

export function normalizeTargets(input: {
  targets?: NoteTargetInput[];
  assigneeUserIds?: string[];
}): NormalizedTarget[] {
  const out: NormalizedTarget[] = [];

  if (Array.isArray(input.targets)) {
    for (const target of input.targets) {
      const parsed = parseTarget(target);
      if (parsed) out.push(parsed);
    }
  }

  // Back-compat: legacy `assigneeUserIds` becomes USER targets.
  if (Array.isArray(input.assigneeUserIds)) {
    for (const userId of input.assigneeUserIds) {
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

export function dedupeTargets(targets: NormalizedTarget[]): NormalizedTarget[] {
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

export function validateUserTargets(
  targets: NormalizedTarget[],
  teamMemberUserIds: Set<string>
): ValidationResult {
  const invalid = targets.find(
    (target) =>
      target.kind === "USER" && !teamMemberUserIds.has(target.userId)
  );
  if (invalid) {
    return {
      ok: false,
      code: "INVALID_ASSIGNEE",
      message: "One or more assignees are not members of this team",
    };
  }
  return { ok: true };
}

export function validateGroupTargets(
  targets: NormalizedTarget[],
  groupIdsForProject: Set<string>
): ValidationResult {
  const invalid = targets.find(
    (target) =>
      target.kind === "GROUP" &&
      !groupIdsForProject.has(target.projectGroupId)
  );
  if (invalid) {
    return {
      ok: false,
      code: "INVALID_GROUP",
      message: "One or more groups don't belong to this project",
    };
  }
  return { ok: true };
}

export function resolveTargetsToUserIds(
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
