import "server-only";
import { db } from "@/lib/db";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { sendGmailMessage } from "@/lib/google-mail";
import { refreshAccessToken } from "@/lib/google-oauth";

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

/** Prepends the company's custom logo (if one is configured) to outgoing
 * email HTML, so white-labeling covers what a customer/employee actually
 * sees in their inbox, not just downloaded PDFs. Silently no-ops without
 * APP_BASE_URL — an email client needs an absolute image URL, and branding
 * is a nice-to-have that must never block a send. */
async function withLogoHeader(companyId: string, html: string): Promise<string> {
  const base = process.env.APP_BASE_URL;
  if (!base) return html;

  const company = await db.company.findUnique({ where: { id: companyId }, select: { logoMimeType: true } });
  if (!company?.logoMimeType) return html;

  return `<img src="${base}/api/company-logo/${companyId}" alt="" style="height:40px;margin-bottom:16px;display:block;" />${html}`;
}

export async function sendEmailForCompany(
  companyId: string,
  { to, subject, html, attachments }: { to: string; subject: string; html: string; attachments?: EmailAttachment[] }
) {
  html = await withLogoHeader(companyId, html);

  const integration = await db.googleIntegration.findUnique({ where: { companyId } });

  if (!integration) {
    return sendEmail({ to, subject, html, attachments });
  }

  let accessToken = integration.accessToken;

  if (integration.expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS < Date.now()) {
    const refreshed = await refreshAccessToken(integration.refreshToken);
    accessToken = refreshed.access_token;
    await db.googleIntegration.update({
      where: { companyId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
  }

  await sendGmailMessage({ accessToken, from: integration.email, to, subject, html, attachments });
}
