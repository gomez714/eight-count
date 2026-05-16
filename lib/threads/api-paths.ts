/**
 * Client-safe URL helpers + the `ThreadTarget` discriminator that
 * parameterizes every thread component, helper, and route over the
 * underlying entity (note today, discussion next).
 *
 * Kept in its own file (not folded into `comments.ts`) so that any
 * surface — server, client, route — can import the type and the path
 * builders without dragging Prisma along.
 */

export type ThreadTarget =
  | { type: "note"; id: string }
  | { type: "discussion"; id: string }

export type ThreadApiPaths = {
  comments: string
  commentById: (commentId: string) => string
  reactions: string
  view: string
}

export function threadApiPaths(target: ThreadTarget): ThreadApiPaths {
  const root =
    target.type === "note"
      ? `/api/notes/${target.id}`
      : `/api/discussions/${target.id}`
  return {
    comments: `${root}/comments`,
    commentById: (commentId) => `${root}/comments/${commentId}`,
    reactions: `${root}/reactions`,
    view: `${root}/thread/view`,
  }
}
