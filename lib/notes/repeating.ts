import { isActiveStatus, type NoteStatus } from "./statuses";
import type { NoteTag } from "./tags";

export const REPEATING_THRESHOLD = 3;

export type RepeatingAssignmentInput = {
  id: string;
  userId: string;
  projectId: string;
  tag: NoteTag | null;
  status: NoteStatus;
};

export type RepeatingCluster = {
  userId: string;
  projectId: string;
  tag: NoteTag;
  assignmentIds: string[];
  count: number;
};

export type RepeatingMarker = {
  tag: NoteTag;
  count: number;
};

/**
 * One assignment's worth of context for the expandable cluster panel —
 * enough to render the timestamps + the most-recent note's body + a link
 * back to its rehearsal. Built by each surface (page entry) inline from
 * its already-fetched active assignments; the type is shared so the
 * panel component doesn't have to know which surface produced it.
 */
export type RepeatingClusterDetailItem = {
  assignmentId: string;
  noteId: string;
  rehearsalId: string;
  rehearsalTitle: string;
  /**
   * Null when the note has no video anchor — the cluster panel falls
   * back to a relative-date pill (built from `createdAtMs`) in place of
   * the `mm:ss` timestamp pill. Links target the same rehearsal page.
   */
  startTimestampMs: number | null;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  voiceTranscript: string | null;
  audioDurationMs: number | null;
  // Numbers (not Dates) so the shape survives the server→client
  // serialization boundary the same way `DrillItem` does.
  createdAtMs: number;
};

export type RepeatingClusterDetail = {
  /**
   * Stable expansion key. `/my-notes` uses the tag alone (one viewer per
   * cluster); project surfaces use `${userId}-${tag}` so two dancers with
   * clusters in the same tag don't collide.
   */
  key: string;
  tag: NoteTag;
  count: number;
  // Items, sorted newest-first by createdAt — the head is the "most
  // recent" one rendered as the quoted body in the panel.
  items: RepeatingClusterDetailItem[];
};

export function detectRepeatingClusters(
  assignments: ReadonlyArray<RepeatingAssignmentInput>,
): RepeatingCluster[] {
  const buckets = new Map<string, RepeatingAssignmentInput[]>();

  for (const a of assignments) {
    if (!a.tag) continue;
    if (!isActiveStatus(a.status)) continue;
    const key = `${a.projectId}::${a.userId}::${a.tag}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(a);
    } else {
      buckets.set(key, [a]);
    }
  }

  const clusters: RepeatingCluster[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < REPEATING_THRESHOLD) continue;
    const head = bucket[0]!;
    clusters.push({
      userId: head.userId,
      projectId: head.projectId,
      tag: head.tag!,
      assignmentIds: bucket.map((a) => a.id),
      count: bucket.length,
    });
  }

  return clusters;
}

export function buildRepeatingMarkerByAssignmentId(
  clusters: ReadonlyArray<RepeatingCluster>,
): Map<string, RepeatingMarker> {
  const map = new Map<string, RepeatingMarker>();
  for (const cluster of clusters) {
    const marker: RepeatingMarker = { tag: cluster.tag, count: cluster.count };
    for (const id of cluster.assignmentIds) {
      map.set(id, marker);
    }
  }
  return map;
}

export function indexClustersByUserAndTag(
  clusters: ReadonlyArray<RepeatingCluster>,
): Map<string, Map<NoteTag, RepeatingCluster>> {
  const map = new Map<string, Map<NoteTag, RepeatingCluster>>();
  for (const cluster of clusters) {
    let inner = map.get(cluster.userId);
    if (!inner) {
      inner = new Map<NoteTag, RepeatingCluster>();
      map.set(cluster.userId, inner);
    }
    inner.set(cluster.tag, cluster);
  }
  return map;
}
