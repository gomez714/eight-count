"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { isAppAdmin } from "@/lib/auth/is-app-admin";
import { db } from "@/lib/db";
import { sendFeedbackResponseEmail } from "@/lib/email/send";
import type { FeedbackCategory } from "@/lib/feedback/categories";

const FEEDBACK_STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "SHIPPED",
  "WONT_DO",
  "DUPLICATE",
] as const;

export type AdminFeedbackActionResult = {
  error?: string;
  success?: boolean;
};

const updateStatusSchema = z.object({
  feedbackId: z.string().min(1),
  status: z.enum(FEEDBACK_STATUSES),
});

const saveNotesSchema = z.object({
  feedbackId: z.string().min(1),
  internalNotes: z.string().max(5000).optional(),
});

const respondSchema = z.object({
  feedbackId: z.string().min(1),
  response: z
    .string()
    .trim()
    .min(1, "Write a response before sending.")
    .max(5000, "Please keep responses under 5000 characters."),
});

/**
 * Single gate used by every admin mutation. Returns the dbUser when
 * authorized, an error result otherwise. Centralizing this means a
 * future ADMIN_EMAILS rotation doesn't need a sweep of action files.
 */
async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; result: AdminFeedbackActionResult }
> {
  const dbUser = await ensureDbUser();
  if (!dbUser) {
    return { ok: false, result: { error: "You must be signed in." } };
  }
  if (!isAppAdmin(dbUser.email)) {
    return { ok: false, result: { error: "Admin access required." } };
  }
  return { ok: true, userId: dbUser.id };
}

export async function updateFeedbackStatus(
  _prevState: AdminFeedbackActionResult,
  formData: FormData
): Promise<AdminFeedbackActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = updateStatusSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await db.feedback.update({
      where: { id: parsed.data.feedbackId },
      data: { status: parsed.data.status },
    });
    revalidatePath("/admin/feedback");
    revalidatePath(`/admin/feedback/${parsed.data.feedbackId}`);
    return { success: true };
  } catch (error) {
    console.error("[admin-feedback] Failed to update status:", error);
    return { error: "Could not update status." };
  }
}

export async function saveInternalNotes(
  _prevState: AdminFeedbackActionResult,
  formData: FormData
): Promise<AdminFeedbackActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = saveNotesSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    internalNotes: formData.get("internalNotes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await db.feedback.update({
      where: { id: parsed.data.feedbackId },
      data: { internalNotes: parsed.data.internalNotes ?? null },
    });
    revalidatePath(`/admin/feedback/${parsed.data.feedbackId}`);
    return { success: true };
  } catch (error) {
    console.error("[admin-feedback] Failed to save notes:", error);
    return { error: "Could not save notes." };
  }
}

export async function respondToFeedback(
  _prevState: AdminFeedbackActionResult,
  formData: FormData
): Promise<AdminFeedbackActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.result;

  const parsed = respondSchema.safeParse({
    feedbackId: formData.get("feedbackId"),
    response: formData.get("response"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Load author + category for the email. Done inline (rather than via
  // a separate helper) because this is the only path that needs them
  // for the email payload.
  const feedback = await db.feedback.findUnique({
    where: { id: parsed.data.feedbackId },
    select: {
      id: true,
      category: true,
      body: true,
      author: { select: { email: true, name: true } },
    },
  });
  if (!feedback) {
    return { error: "Feedback not found." };
  }

  try {
    await db.feedback.update({
      where: { id: feedback.id },
      data: {
        adminResponse: parsed.data.response,
        respondedAt: new Date(),
        // Don't auto-advance status — operator might want to send a
        // "what did you mean by X?" without flipping it to SHIPPED.
        // They can update status separately via the inline dropdown.
      },
    });

    after(async () => {
      try {
        await sendFeedbackResponseEmail({
          toEmail: feedback.author.email,
          toName: feedback.author.name,
          category: feedback.category as FeedbackCategory,
          originalBody: feedback.body,
          response: parsed.data.response,
        });
      } catch (error) {
        console.error("[admin-feedback] Failed to email response:", error);
      }
    });

    revalidatePath(`/admin/feedback/${feedback.id}`);
    return { success: true };
  } catch (error) {
    console.error("[admin-feedback] Failed to record response:", error);
    return { error: "Could not save response." };
  }
}
