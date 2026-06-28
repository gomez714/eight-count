import { Resend } from "resend";

import type { TeamRole } from "@/generated/prisma/client";

import type { DigestPayload } from "@/lib/digest/build-digest";
import { renderDigestEmail } from "@/lib/digest/render-email";
import { signUnsubscribeToken } from "@/lib/digest/token";
import type { FeedbackCategory } from "@/lib/feedback/categories";
import { FEEDBACK_CATEGORY_LABELS } from "@/lib/feedback/categories";

const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

// Support inbox the operator monitors. Surfaced as the Reply-To on
// every transactional email so replies go to a real human during the
// beta (keep in sync with `CONTACT_EMAIL` in app/privacy/page.tsx).
const SUPPORT_REPLY_TO = "lgomez00714@gmail.com";

// Default From address for daily digest. Domain (`eightcountnotes.com`)
// is already verified in Resend for invitation sending; `digest@` is a
// new local-part on the same domain so no DNS changes are needed.
const DEFAULT_DIGEST_FROM = "Eight Count <digest@eightcountnotes.com>";

let cachedClient: Resend | null = null;

function getResend(): Resend {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "Eight Count <onboarding@resend.dev>";
}

function getDigestFromAddress(): string {
  return process.env.EMAIL_DIGEST_FROM ?? DEFAULT_DIGEST_FROM;
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set.");
  }
  return url.replace(/\/$/, "");
}

export type SendInvitationEmailParams = {
  to: string;
  teamName: string;
  inviterName: string | null;
  inviterEmail: string;
  role: TeamRole;
  rawToken: string;
  expiresAt: Date;
};

export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<void> {
  const acceptUrl = `${getAppUrl()}/invite/${params.rawToken}`;
  const inviterDisplay = params.inviterName?.trim() || params.inviterEmail;
  const roleLabel = ROLE_LABEL[params.role];
  const expiresLabel = formatExpiry(params.expiresAt);

  const subject = `${inviterDisplay} invited you to ${params.teamName} on Eight Count`;

  const text = [
    `${inviterDisplay} invited you to join "${params.teamName}" on Eight Count as a ${roleLabel}.`,
    ``,
    `Accept the invitation:`,
    acceptUrl,
    ``,
    `This link expires on ${expiresLabel}.`,
    ``,
    `Eight Count is a tool for giving and tracking rehearsal notes. If you weren't expecting this invitation, you can safely ignore this email.`,
    ``,
    `After you accept, you'll get a daily digest from Eight Count when there's new activity on your team — never on quiet days. You can turn this off anytime in your email preferences.`,
  ].join("\n");

  const html = renderInvitationHtml({
    teamName: params.teamName,
    inviterDisplay,
    roleLabel,
    acceptUrl,
    expiresLabel,
  });

  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to: params.to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Failed to send invitation email."
    );
  }
}

function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function renderInvitationHtml(params: {
  teamName: string;
  inviterDisplay: string;
  roleLabel: string;
  acceptUrl: string;
  expiresLabel: string;
}): string {
  const { teamName, inviterDisplay, roleLabel, acceptUrl, expiresLabel } =
    params;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e7e5e0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#7d8a82;">
                  Eight Count
                </div>
                <h1 style="margin:12px 0 8px;font-size:22px;line-height:1.3;font-weight:600;">
                  You're invited to ${escapeHtml(teamName)}
                </h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3a3a3a;">
                  <strong>${escapeHtml(inviterDisplay)}</strong> invited you to join
                  <strong>${escapeHtml(teamName)}</strong> as a
                  <strong>${escapeHtml(roleLabel)}</strong>.
                </p>
                <a href="${acceptUrl}"
                  style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:999px;">
                  Accept invitation
                </a>
                <p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#6b6b6b;">
                  Or paste this link into your browser:
                </p>
                <p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;color:#0f766e;">
                  ${acceptUrl}
                </p>
                <p style="margin:0 0 4px;font-size:12.5px;color:#7d8a82;">
                  This invitation expires on ${escapeHtml(expiresLabel)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid #f0eeea;background:#fafaf8;">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.55;color:#8a8a8a;">
                  Eight Count is a tool for giving and tracking rehearsal notes. If you weren't expecting this invitation, you can safely ignore this email.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.55;color:#8a8a8a;">
                  After you accept, you'll get a daily digest from Eight Count when there's new activity on your team — never on quiet days. You can turn this off anytime in your email preferences.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type SendDigestEmailParams = {
  to: string;
  userId: string;
  firstName: string | null;
  payload: DigestPayload;
};

/**
 * Sends a single daily-digest email. Renders subject + HTML + text from
 * the payload, attaches a signed unsubscribe URL to both the visible
 * footer and the `List-Unsubscribe` headers (so Gmail / Apple Mail
 * surface their native unsubscribe button per RFC 8058).
 */
export async function sendDigestEmail(
  params: SendDigestEmailParams
): Promise<void> {
  const appUrl = getAppUrl();
  const token = signUnsubscribeToken(params.userId);
  const unsubscribeUrl = `${appUrl}/digest/unsubscribe?token=${encodeURIComponent(token)}`;
  const preferencesUrl = `${appUrl}/settings/notifications`;

  const rendered = renderDigestEmail({
    payload: params.payload,
    firstName: params.firstName,
    appUrl,
    unsubscribeUrl,
    preferencesUrl,
  });

  const { error } = await getResend().emails.send({
    from: getDigestFromAddress(),
    to: params.to,
    replyTo: SUPPORT_REPLY_TO,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    headers: {
      // RFC 2369 + RFC 8058. Both URLs go to our `/api/digest/unsubscribe`
      // endpoint — GET for the visible footer link (idempotent on the
      // user's row), POST for Gmail's "one-click" header. The mailto:
      // fallback covers older clients that only handle that scheme.
      "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${SUPPORT_REPLY_TO}?subject=Unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Failed to send digest email."
    );
  }
}

export type SendFeedbackResponseEmailParams = {
  toEmail: string;
  toName: string | null;
  category: FeedbackCategory;
  originalBody: string;
  response: string;
};

/**
 * Replies to a feedback submitter with the admin's response. From
 * address is the support inbox so the user can plain-reply to continue
 * the thread (Reply-To is also set to it explicitly — some clients
 * prefer one signal over the other).
 *
 * Plain text only — admin response text is operator-controlled and
 * does not benefit from a templated layout. Keeps the email
 * conversational rather than transactional.
 */
export async function sendFeedbackResponseEmail(
  params: SendFeedbackResponseEmailParams
): Promise<void> {
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[params.category];
  const greeting = params.toName?.trim()
    ? `Hi ${params.toName.trim().split(/\s+/)[0]},`
    : "Hi,";

  const subject = `Re: your ${categoryLabel.toLowerCase()} on Eight Count`;

  const quotedOriginal = params.originalBody
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  const text = [
    greeting,
    ``,
    params.response,
    ``,
    `— Luis`,
    ``,
    `---`,
    `You wrote:`,
    quotedOriginal,
    ``,
    `Reply to this email if you'd like to continue the conversation.`,
  ].join("\n");

  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to: params.toEmail,
    replyTo: SUPPORT_REPLY_TO,
    subject,
    text,
  });

  if (error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Failed to send feedback response."
    );
  }
}

export type SendFeedbackNotificationParams = {
  feedbackId: string;
  category: FeedbackCategory;
  body: string;
  pageUrl: string;
  authorEmail: string;
  authorName: string | null;
};

/**
 * Notifies the operator (SUPPORT_REPLY_TO) when a new feedback row
 * lands. Reply-To is set to the submitter's email so a plain "reply"
 * routes directly to them — the email *is* the conversational
 * channel during the beta (we don't ship an in-app "My feedback" page
 * in v1). The admin surface at `/admin/feedback/{id}` is for triage +
 * status updates; correspondence happens over email.
 */
export async function sendFeedbackNotification(
  params: SendFeedbackNotificationParams
): Promise<void> {
  const appUrl = getAppUrl();
  const triageUrl = `${appUrl}/admin/feedback/${params.feedbackId}`;
  const authorDisplay = params.authorName?.trim() || params.authorEmail;
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[params.category];
  const excerpt = params.body.length > 60
    ? `${params.body.slice(0, 60).trimEnd()}…`
    : params.body;

  const subject = `[Feedback · ${categoryLabel}] ${authorDisplay} — ${excerpt}`;

  const text = [
    `New ${categoryLabel.toLowerCase()} from ${authorDisplay} (${params.authorEmail})`,
    ``,
    `On page: ${params.pageUrl}`,
    ``,
    params.body,
    ``,
    `---`,
    `Triage: ${triageUrl}`,
    `Reply to this email to respond to ${authorDisplay} directly.`,
  ].join("\n");

  const { error } = await getResend().emails.send({
    from: getFromAddress(),
    to: SUPPORT_REPLY_TO,
    replyTo: params.authorEmail,
    subject,
    text,
  });

  if (error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Failed to send feedback notification."
    );
  }
}
