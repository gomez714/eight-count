import "server-only"

import { db } from "@/lib/db"
import type { ProjectResourceRow } from "./types"

/**
 * Cap on the number of resources returned per project in a single
 * request. v1 expects realistic usage well below this; promote to
 * cursor pagination if it ever pinches.
 */
const RESOURCES_PER_PROJECT_LIMIT = 100

/**
 * List all resources for a project, newest-first. Returns the flat
 * `ProjectResourceRow` shape consumed by the UI directly so page
 * entries stay thin.
 *
 * Caller is responsible for verifying the viewer can access the
 * project (typically via `getProjectForUser`); this helper does not
 * gate on team membership itself — matches the `getDiscussionsForProject`
 * convention.
 */
export async function getResourcesForProject(
  projectId: string
): Promise<ProjectResourceRow[]> {
  const rows = await db.projectResource.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: RESOURCES_PER_PROJECT_LIMIT,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
          deletedAt: true,
        },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    rehearsalId: row.rehearsalId,
    resourceType: row.resourceType,
    title: row.title,
    url: row.url,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.createdBy,
  }))
}
