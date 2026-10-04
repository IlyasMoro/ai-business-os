import "server-only";
import { db } from "@/lib/db";
import { refreshAccessToken } from "@/lib/google-oauth";

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Whether the connected Google account allowed reading mail. */
export function canReadMail(integration: { scopes: string } | null | undefined): boolean {
  return Boolean(integration?.scopes.split(/\s+/).includes(GMAIL_READ_SCOPE));
}

/** A working access token for the company's connected Google account,
 * refreshed (and saved) when it is about to expire. */
export async function googleAccessToken(integration: {
  companyId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<string> {
  if (integration.expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS >= Date.now()) return integration.accessToken;
  const refreshed = await refreshAccessToken(integration.refreshToken);
  await db.googleIntegration.update({
    where: { companyId: integration.companyId },
    data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
  });
  return refreshed.access_token;
}
