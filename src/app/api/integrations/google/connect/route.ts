import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { hasRole, requireModuleApi } from "@/lib/dal";
import { getGoogleAuthUrl } from "@/lib/google-oauth";
import { hasFeature } from "@/lib/plan-limits";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const session = await requireModuleApi("integrations");
  if (session instanceof Response) return session;
  const base = process.env.APP_BASE_URL ?? new URL(request.url).origin;

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    return NextResponse.redirect(new URL("/dashboard/integrations?error=forbidden", base));
  }
  // Integrations come with Starter and up; the page explains which plan.
  if (!(await hasFeature(session.companyId, "integrations"))) {
    return NextResponse.redirect(new URL("/dashboard/integrations", base));
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
    // ?mail=1 comes from the CRM settings: also ask to read mail, for logging customer emails.
    const readMail = new URL(request.url).searchParams.get("mail") === "1";
    // Send them back where they started once Google is done.
    cookieStore.set("google_oauth_return", readMail ? "crm" : "integrations", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(getGoogleAuthUrl(state, { readMail }));
  } catch (err) {
    console.error("[google-oauth] connect failed:", err);
    return NextResponse.redirect(new URL("/dashboard/integrations?error=invalid", base));
  }
}
