import type {
  DigestNoteItem,
  DigestPayload,
  DigestStalledItem,
  DigestThreadItem,
} from "./build-digest";

export type RenderDigestEmailParams = {
  payload: DigestPayload;
  firstName: string | null;
  appUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
};

export type RenderedDigestEmail = {
  subject: string;
  /** Preview text shown beneath the subject line in most inbox clients. */
  preheader: string;
  html: string;
  text: string;
};

/**
 * Renders the full email — subject, preheader, HTML body, and plain
 * text body — from a digest payload. Pure: no I/O, no DB calls.
 *
 * Email-rendering rules followed here:
 *   - Inline styles only (Gmail strips <style> blocks).
 *   - Table-based layout for max client compatibility.
 *   - System font stack only (no webfonts — render unpredictably).
 *   - Brand teal `#0f766e` matches the invitation email exactly.
 *   - Preheader uses zero-width chars to push the trailing fallback
 *     out of preview (otherwise some clients leak "View this email…").
 */
export function renderDigestEmail({
  payload,
  firstName,
  appUrl,
  unsubscribeUrl,
  preferencesUrl,
}: RenderDigestEmailParams): RenderedDigestEmail {
  const subject = buildSubject(payload);
  const preheader = buildPreheader(payload);
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return {
    subject,
    preheader,
    html: renderHtml({
      payload,
      greeting,
      preheader,
      appUrl,
      unsubscribeUrl,
      preferencesUrl,
    }),
    text: renderText({
      payload,
      greeting,
      appUrl,
      unsubscribeUrl,
      preferencesUrl,
    }),
  };
}

function buildSubject(payload: DigestPayload): string {
  if (payload.newAssignmentsTotal > 0) {
    const first = payload.newAssignments[0];
    const author = first?.authorName ? first.authorName.split(/\s+/u)[0] : null;
    if (payload.newAssignmentsTotal === 1) {
      return author
        ? `New note from ${author}`
        : `1 new note for you on Eight Count`;
    }
    if (author && payload.newAssignmentsTotal === 2) {
      return `${author} and 1 other left you new notes`;
    }
    if (author) {
      return `${author} and ${payload.newAssignmentsTotal - 1} others left you new notes`;
    }
    return `${payload.newAssignmentsTotal} new notes for you on Eight Count`;
  }
  if (payload.newRepliesTotal > 0) {
    const noun = payload.newRepliesTotal === 1 ? "thread" : "threads";
    return `New replies on ${payload.newRepliesTotal} ${noun}`;
  }
  if (payload.stalledNotesTotal > 0) {
    const noun = payload.stalledNotesTotal === 1 ? "note" : "notes";
    return `${payload.stalledNotesTotal} of your ${noun} are still waiting`;
  }
  // Shouldn't reach — `buildDigest` returns null when all three are zero.
  return "Your Eight Count digest";
}

function buildPreheader(payload: DigestPayload): string {
  const parts: string[] = [];
  if (payload.newAssignmentsTotal > 0) {
    const first = payload.newAssignments[0];
    if (first?.bodyPreview) parts.push(first.bodyPreview);
  } else if (payload.newRepliesTotal > 0) {
    parts.push(`${payload.newRepliesTotal} new ${payload.newRepliesTotal === 1 ? "reply" : "replies"} on your threads`);
  } else if (payload.stalledNotesTotal > 0) {
    parts.push(
      `${payload.stalledNotesTotal} ${payload.stalledNotesTotal === 1 ? "note" : "notes"} you authored haven't been addressed yet`
    );
  }
  return parts.join(" · ").slice(0, 140);
}

type HtmlRenderArgs = {
  payload: DigestPayload;
  greeting: string;
  preheader: string;
  appUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
};

function renderHtml({
  payload,
  greeting,
  preheader,
  appUrl,
  unsubscribeUrl,
  preferencesUrl,
}: HtmlRenderArgs): string {
  const sections: string[] = [];

  if (payload.isFirstDigest) {
    sections.push(`
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3a3a3a;">
        Welcome to your Eight Count digest. We'll email you once a day when there's something new — and skip days when there isn't.
      </p>
    `);
  }

  if (payload.newAssignments.length > 0) {
    sections.push(
      renderSection({
        title:
          payload.newAssignmentsTotal === 1
            ? "1 new note for you"
            : `${payload.newAssignmentsTotal} new notes for you`,
        body: payload.newAssignments
          .map((item) => renderAssignmentItem(item, appUrl))
          .join(""),
        moreCount: Math.max(
          payload.newAssignmentsTotal - payload.newAssignments.length,
          0
        ),
        moreLabel: "notes",
        moreHref: `${appUrl}/my-notes`,
      })
    );
  }

  if (payload.newReplies.length > 0) {
    sections.push(
      renderSection({
        title:
          payload.newRepliesTotal === 1
            ? "1 new reply"
            : `${payload.newRepliesTotal} new replies`,
        body: payload.newReplies
          .map((item) => renderReplyItem(item, appUrl))
          .join(""),
        moreCount: Math.max(
          payload.newRepliesTotal - payload.newReplies.length,
          0
        ),
        moreLabel: "threads",
        moreHref: `${appUrl}/dashboard`,
      })
    );
  }

  if (payload.stalledNotes.length > 0) {
    sections.push(
      renderSection({
        title:
          payload.stalledNotesTotal === 1
            ? "1 note still waiting"
            : `${payload.stalledNotesTotal} notes still waiting`,
        body: payload.stalledNotes
          .map((item) => renderStalledItem(item, appUrl))
          .join(""),
        moreCount: Math.max(
          payload.stalledNotesTotal - payload.stalledNotes.length,
          0
        ),
        moreLabel: "stalled notes",
        moreHref: `${appUrl}/notes-by-me`,
        tone: "warm",
      })
    );
  }

  return `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
  </head>
  <body style="margin:0;padding:0;background:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1c;">
    <div style="display:none!important;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">
      ${escapeHtml(preheader)}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e7e5e0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#7d8a82;">
                  Eight Count · Daily digest
                </div>
                <p style="margin:14px 0 6px;font-size:16px;line-height:1.55;color:#1c1c1c;">
                  ${escapeHtml(greeting)}
                </p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#5a5a5a;">
                  Here's what's new since your last digest.
                </p>
                ${sections.join("\n")}
                <p style="margin:24px 0 0;">
                  <a href="${escapeAttr(`${appUrl}/dashboard`)}"
                    style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:999px;">
                    Open Eight Count
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid #f0eeea;background:#fafaf8;">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.55;color:#8a8a8a;">
                  You're getting this because daily digests are turned on for your account. We only send when there's new activity — never on quiet days.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.55;color:#8a8a8a;">
                  <a href="${escapeAttr(preferencesUrl)}" style="color:#0f766e;text-decoration:underline;">Manage email preferences</a>
                  &nbsp;·&nbsp;
                  <a href="${escapeAttr(unsubscribeUrl)}" style="color:#0f766e;text-decoration:underline;">Unsubscribe</a>
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

type RenderSectionArgs = {
  title: string;
  body: string;
  moreCount: number;
  moreLabel: string;
  moreHref: string;
  tone?: "default" | "warm";
};

function renderSection({
  title,
  body,
  moreCount,
  moreLabel,
  moreHref,
  tone = "default",
}: RenderSectionArgs): string {
  const headerColor = tone === "warm" ? "#a86b3c" : "#0f766e";
  const moreLink =
    moreCount > 0
      ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.5;">
          <a href="${escapeAttr(moreHref)}" style="color:#0f766e;text-decoration:underline;">
            See all ${moreCount} more ${escapeHtml(moreLabel)} →
          </a>
        </p>`
      : "";

  return `
    <div style="margin:0 0 22px;">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${headerColor};margin:0 0 10px;">
        ${escapeHtml(title)}
      </div>
      ${body}
      ${moreLink}
    </div>
  `;
}

function renderAssignmentItem(item: DigestNoteItem, appUrl: string): string {
  const href = `${appUrl}/rehearsals/${encodeURIComponent(item.rehearsalId)}`;
  const icon = item.isVoice ? "🎙️" : "📝";
  const preview = item.bodyPreview || (item.isVoice ? "Voice note" : "");

  return `
    <a href="${escapeAttr(href)}" style="display:block;text-decoration:none;color:inherit;border:1px solid #ebe9e3;border-radius:10px;padding:14px 16px;margin:0 0 8px;background:#ffffff;">
      <div style="font-size:12px;color:#7d8a82;margin:0 0 4px;">
        ${escapeHtml(item.projectTitle)} · ${escapeHtml(item.rehearsalTitle)}
      </div>
      <div style="font-size:14px;line-height:1.5;color:#1c1c1c;margin:0 0 4px;">
        ${icon} <strong>${escapeHtml(item.authorName)}</strong>: ${escapeHtml(preview)}
      </div>
    </a>
  `;
}

function renderReplyItem(item: DigestThreadItem, appUrl: string): string {
  const href = item.rehearsalId
    ? `${appUrl}/rehearsals/${encodeURIComponent(item.rehearsalId)}`
    : `${appUrl}/dashboard`;
  const countLabel =
    item.newCommentCount === 1
      ? "1 new reply"
      : `${item.newCommentCount} new replies`;

  return `
    <a href="${escapeAttr(href)}" style="display:block;text-decoration:none;color:inherit;border:1px solid #ebe9e3;border-radius:10px;padding:14px 16px;margin:0 0 8px;background:#ffffff;">
      <div style="font-size:12px;color:#7d8a82;margin:0 0 4px;">
        ${escapeHtml(item.projectTitle)}
      </div>
      <div style="font-size:14px;line-height:1.5;color:#1c1c1c;">
        💬 <strong>${escapeHtml(countLabel)}</strong> on ${escapeHtml(item.threadLabel)}
      </div>
    </a>
  `;
}

function renderStalledItem(item: DigestStalledItem, appUrl: string): string {
  const href = `${appUrl}/rehearsals/${encodeURIComponent(item.rehearsalId)}`;
  const recipientLabel =
    item.activeRecipientCount === 1
      ? "1 recipient hasn't addressed it"
      : `${item.activeRecipientCount} recipients haven't addressed it`;
  const preview = item.bodyPreview || (item.isVoice ? "Voice note" : "");

  return `
    <a href="${escapeAttr(href)}" style="display:block;text-decoration:none;color:inherit;border:1px solid #f3e3d4;border-radius:10px;padding:14px 16px;margin:0 0 8px;background:#fdf8f3;">
      <div style="font-size:12px;color:#a86b3c;margin:0 0 4px;">
        ${escapeHtml(item.projectTitle)} · ${escapeHtml(item.rehearsalTitle)} · ${item.ageInDays}d ago
      </div>
      <div style="font-size:14px;line-height:1.5;color:#1c1c1c;margin:0 0 4px;">
        ${escapeHtml(preview)}
      </div>
      <div style="font-size:12px;color:#7d6a55;">
        ${escapeHtml(recipientLabel)}
      </div>
    </a>
  `;
}

type TextRenderArgs = {
  payload: DigestPayload;
  greeting: string;
  appUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
};

function renderText({
  payload,
  greeting,
  appUrl,
  unsubscribeUrl,
  preferencesUrl,
}: TextRenderArgs): string {
  const lines: string[] = [];
  lines.push(greeting, "");
  if (payload.isFirstDigest) {
    lines.push(
      "Welcome to your Eight Count digest. We'll email you once a day when there's something new — and skip days when there isn't.",
      ""
    );
  }
  lines.push("Here's what's new since your last digest.", "");

  if (payload.newAssignments.length > 0) {
    lines.push(
      payload.newAssignmentsTotal === 1
        ? "NEW NOTES FOR YOU (1)"
        : `NEW NOTES FOR YOU (${payload.newAssignmentsTotal})`
    );
    for (const item of payload.newAssignments) {
      const icon = item.isVoice ? "[voice]" : "[text]";
      lines.push(
        `- ${item.projectTitle} · ${item.rehearsalTitle}`,
        `  ${icon} ${item.authorName}: ${item.bodyPreview || (item.isVoice ? "Voice note" : "")}`,
        `  ${appUrl}/rehearsals/${item.rehearsalId}`,
        ""
      );
    }
    const remaining = payload.newAssignmentsTotal - payload.newAssignments.length;
    if (remaining > 0) {
      lines.push(`See all ${remaining} more notes: ${appUrl}/my-notes`, "");
    }
  }

  if (payload.newReplies.length > 0) {
    lines.push(
      payload.newRepliesTotal === 1
        ? "NEW REPLIES (1)"
        : `NEW REPLIES (${payload.newRepliesTotal})`
    );
    for (const item of payload.newReplies) {
      const target = item.rehearsalId
        ? `${appUrl}/rehearsals/${item.rehearsalId}`
        : `${appUrl}/dashboard`;
      const countLabel =
        item.newCommentCount === 1
          ? "1 new reply"
          : `${item.newCommentCount} new replies`;
      lines.push(
        `- ${item.projectTitle}: ${countLabel} on ${item.threadLabel}`,
        `  ${target}`,
        ""
      );
    }
  }

  if (payload.stalledNotes.length > 0) {
    lines.push(
      payload.stalledNotesTotal === 1
        ? "STILL WAITING (1)"
        : `STILL WAITING (${payload.stalledNotesTotal})`
    );
    for (const item of payload.stalledNotes) {
      const recipientLabel =
        item.activeRecipientCount === 1
          ? "1 recipient hasn't addressed it"
          : `${item.activeRecipientCount} recipients haven't addressed it`;
      lines.push(
        `- ${item.projectTitle} · ${item.rehearsalTitle} (${item.ageInDays}d ago)`,
        `  ${item.bodyPreview || (item.isVoice ? "Voice note" : "")}`,
        `  ${recipientLabel}`,
        `  ${appUrl}/rehearsals/${item.rehearsalId}`,
        ""
      );
    }
  }

  lines.push(
    "---",
    `Open Eight Count: ${appUrl}/dashboard`,
    "",
    "You're getting this because daily digests are turned on for your account.",
    `Manage preferences: ${preferencesUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`
  );

  return lines.join("\n");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string): string {
  // URLs are placed inside double-quoted attributes; escape the same
  // metacharacters as escapeHtml plus newlines. Tokens are base64url so
  // they're already attribute-safe, but tightening here means future
  // URL-shape changes can't break the markup.
  return escapeHtml(input).replace(/\r?\n/g, "");
}
