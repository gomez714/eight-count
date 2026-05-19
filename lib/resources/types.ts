import type { ResourceType } from "@/generated/prisma/client"

export type ProjectResourceAuthor = {
  id: string
  name: string | null
  email: string
  imageUrl: string | null
  deletedAt: Date | null
}

/**
 * Flat row shape consumed by the resource UI components. Built by
 * `getResourcesForProject` so page entries stay thin — they pass
 * `ProjectResourceRow[]` straight through to the section card.
 *
 * `resourceType` is typed as the Prisma enum so it auto-widens when
 * v1.5 adds `FILE` — no callers will need updating, only the row
 * renderer that branches on the variant.
 *
 * Dates are kept as `Date` objects (not serialized strings) — Next.js
 * server → client component prop serialization handles them natively,
 * and the row stays usable from server components without conversion.
 */
export type ProjectResourceRow = {
  id: string
  projectId: string
  rehearsalId: string | null
  resourceType: ResourceType
  title: string
  url: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  author: ProjectResourceAuthor
}
