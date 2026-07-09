import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { verifySession, hasRole } from "@/lib/dal";
import { getGoogleAuthUrl } from "@/lib/google-oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const session = await verifySession();
  const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=forbidden", base));
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  try {
    return NextResponse.redirect(getGoogleAuthUrl(state));
  } catch (err) {
    console.error("[google-oauth] connect failed:", err);
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
  }
}
