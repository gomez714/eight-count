"use server";

import { after } from "next/server";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { sendFeedbackNotification } from "@/lib/email/send";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_BODY_MIN_LENGTH,
  FEEDBACK_CATEGORIES,
} from "@/lib/feedback/categories";
import { resolveFeedbackContext } from "@/lib/feedback/resolve-feedback-context";

export type FeedbackActionResult = {
  error?: string;
  success?: boolean;
};

const submitSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  body: z
    .string()
    .trim()
    .min(
      FEEDBACK_BODY_MIN_LENGTH,
      `Please add a bit more detail (at least ${FEEDBACK_BODY_MIN_LENGTH} characters).`
    )
    .max(
      FEEDBACK_BODY_MAX_LENGTH,
      `Please keep it under ${FEEDBACK_BODY_MAX_LENGTH} characters.`
    ),
  // `pageUrl` is sent by the client from `window.location.pathname` so
  // the row is anchored to the surface the user was on. It's validated
  // by the resolver (only IDs the user can actually access are attached);
  // a missing or junk URL just yields a context-less row, which is fine.
  pageUrl: z.string().max(2048).optional(),
  userAgent: z.string().max(500).optional(),
});

export async function submitFeedback(
  _prevState: FeedbackActionResult,
  formData: FormData
): Promise<FeedbackActionResult> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { error: "You must be signed in to send feedback." };
  }

  const parsed = submitSchema.safeParse({
    category: formData.get("category"),
    body: formData.get("body"),
    pageUrl: formData.get("pageUrl") || undefined,
    userAgent: formData.get("userAgent") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please fill out the form.",
    };
  }

  const { category, body, pageUrl, userAgent } = parsed.data;
  const normalizedPageUrl = pageUrl ?? "/";

  // Server-resolves IDs from pageUrl + verifies access. Never trust
  // client-attached anchors — see resolveFeedbackContext.
  const context = await resolveFeedbackContext(normalizedPageUrl, dbUser.id);

  try {
    const feedback = await db.feedback.create({
      data: {
        authorUserId: dbUser.id,
        category,
        body,
        pageUrl: normalizedPageUrl,
        userAgent: userAgent ?? null,
        teamId: context.teamId,
        projectId: context.projectId,
        rehearsalId: context.rehearsalId,
      },
      select: { id: true },
    });

    // Fire-and-forget admin notification. Failures don't block the
    // user's success state — they'd just mean the email didn't land,
    // which the row in `/admin/feedback` still surfaces.
    after(async () => {
      try {
        await sendFeedbackNotification({
          feedbackId: feedback.id,
          category,
          body,
          pageUrl: normalizedPageUrl,
          authorEmail: dbUser.email,
          authorName: dbUser.name,
        });
      } catch (error) {
        console.error("[feedback] Failed to email admin:", error);
      }
    });

    return { success: true };
  } catch (error) {
    console.error("[feedback] Failed to create row:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
