import { z } from "zod"

export const RESOURCE_TITLE_MAX = 120
export const RESOURCE_URL_MAX = 2048
export const RESOURCE_DESCRIPTION_MAX = 280

/**
 * URL validator. Only `http:` and `https:` are accepted — explicitly
 * blocks `javascript:`, `data:`, `file:`, and other dangerous schemes.
 * Whitespace is trimmed before parsing.
 *
 * Length cap is enforced both here and at the DB-input layer; the
 * Prisma column is unbounded by convention (matches Project.title,
 * Note.bodyText, etc.) so validation is the single source of truth.
 */
const urlSchema = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .max(RESOURCE_URL_MAX, `URL must be ${RESOURCE_URL_MAX} characters or less.`)
  .refine(
    (value) => {
      try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "URL must be a valid http or https link." }
  )

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(
    RESOURCE_TITLE_MAX,
    `Title must be ${RESOURCE_TITLE_MAX} characters or less.`
  )

/**
 * Description is optional; an empty submission collapses to `null` so
 * the row doesn't render a dangling separator dot between the domain
 * hint and a zero-length string.
 */
const descriptionSchema = z
  .string()
  .trim()
  .max(
    RESOURCE_DESCRIPTION_MAX,
    `Description must be ${RESOURCE_DESCRIPTION_MAX} characters or less.`
  )
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))

export const createResourceSchema = z.object({
  title: titleSchema,
  url: urlSchema,
  description: descriptionSchema,
})

/**
 * Update shape is identical to create in v1 — the edit form always
 * submits all three fields, so we do a full replace rather than PATCH.
 * Kept as a distinct named schema so future divergence (e.g. allowing
 * just-the-title quick edits) doesn't require renaming everywhere.
 */
export const updateResourceSchema = z.object({
  title: titleSchema,
  url: urlSchema,
  description: descriptionSchema,
})

export type CreateResourceInput = z.infer<typeof createResourceSchema>
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>
