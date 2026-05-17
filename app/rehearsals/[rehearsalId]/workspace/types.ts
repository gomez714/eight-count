export type AssignableMember = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";
};

export type NoteAssignmentStatusItem = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "ADDRESSED" | "RESOLVED";
};

export type NoteAssignmentItem = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  status: NoteAssignmentStatusItem | null;
};

export type NoteTargetItem = {
  id: string;
  kind: "EVERYONE" | "GROUP" | "USER";
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  group: { id: string; name: string } | null;
};

export type AvailableGroup = {
  id: string;
  name: string;
  /** User IDs of group members (resolved from TeamMember -> User). */
  memberUserIds: string[];
};

export type AudioAssetItem = {
  id: string;
  mimeType: string;
  durationMs: number | null;
  status: "UPLOADING" | "READY" | "FAILED";
  transcript: string | null;
  transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
};

import type { NoteTag } from "@/lib/notes/tags";
import type { ThreadReactionSummary } from "@/lib/threads/comments";

export type RepeatingMarker = {
  tag: NoteTag;
  count: number;
};

export type NoteThreadSummaryItem = {
  commentCount: number;
  reactions: ThreadReactionSummary[];
  hasUnread: boolean;
};

export type NoteItem = {
  id: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  startTimestampMs: number;
  endTimestampMs: number | null;
  tag: NoteTag | null;
  audioAsset: AudioAssetItem | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  assignments: NoteAssignmentItem[];
  /**
   * Per-assignment repeating marker, keyed by assignment.id. Only contains
   * entries for assignments that are part of a repeating cluster
   * (>= REPEATING_THRESHOLD active assignments with the same tag for the
   * same recipient in the same project).
   */
  repeatingByAssignmentId?: Record<string, RepeatingMarker>;
  targets: NoteTargetItem[];
  /** Pre-computed thread summary for the current viewer (chip seed). */
  thread: NoteThreadSummaryItem;
};

/**
 * Workspace-scoped shape for a Discussion. Mirrors NoteItem where it
 * shares semantics, omits what doesn't apply (no targets, no assignments,
 * no tag in v1), and makes the timestamp fields nullable since
 * discussions can be unanchored. The thread summary uses the same
 * `NoteThreadSummaryItem` shape — the chip is target-agnostic.
 */
export type DiscussionItem = {
  id: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  /** null = unanchored. */
  startTimestampMs: number | null;
  /** null = single timestamp (or unanchored). */
  endTimestampMs: number | null;
  audioAsset: AudioAssetItem | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  /** Pre-computed thread summary for the current viewer (chip seed). */
  thread: NoteThreadSummaryItem;
};