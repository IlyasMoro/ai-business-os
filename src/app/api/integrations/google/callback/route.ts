import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { exchangeCodeForTokens, getGoogleUserEmail } from "@/lib/google-oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const session = await verifySession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const base = process.env.APP_BASE_URL ?? url.origin;

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (errorParam) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
    }
    const email = await getGoogleUserEmail(tokens.access_token);

    await db.googleIntegration.upsert({
      where: { companyId: session.companyId },
      create: {
        companyId: session.companyId,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(new URL("/dashboard/integrations?connected=1", base));
  } catch (err) {
    console.error("[google-oauth] callback failed:", err);
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
  }
}
