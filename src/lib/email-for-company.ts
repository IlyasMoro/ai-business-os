import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendGmailMessage } from "@/lib/google-mail";
import { refreshAccessToken } from "@/lib/google-oauth";

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export async function sendEmailForCompany(
  companyId: string,
  { to, subject, html }: { to: string; subject: string; html: string }
) {
  const integration = await db.googleIntegration.findUnique({ where: { companyId } });

  if (!integration) {
    return sendEmail({ to, subject, html });
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

  await sendGmailMessage({ accessToken, from: integration.email, to, subject, html });
}
