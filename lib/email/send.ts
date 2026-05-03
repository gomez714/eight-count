import { Resend } from "resend";

import type { TeamRole } from "@/generated/prisma/client";

const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

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

function getAppUrl(): string {
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
                <p style="margin:0;font-size:12px;line-height:1.55;color:#8a8a8a;">
                  Eight Count is a tool for giving and tracking rehearsal notes. If you weren't expecting this invitation, you can safely ignore this email.
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
