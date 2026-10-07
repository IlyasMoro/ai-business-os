import { NextResponse } from "next/server";
import { authorizationUrl, enabledProviders, isOAuthProvider, newOAuthRequest, saveOAuthRequest } from "@/lib/oauth-login";
import { getSessionPayload } from "@/lib/session";

/* Starts "Continue with Google / Microsoft". ?mode=link (from My account,
   signed in) connects the account instead of signing in; ?remember=1 keeps
   the sign in for 30 days, like the checkbox on the password form. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const base = process.env.APP_BASE_URL ?? url.origin;

  if (!isOAuthProvider(provider) || !enabledProviders().includes(provider)) {
    return NextResponse.redirect(new URL("/login?oauth=unavailable", base));
  }

  const mode = url.searchParams.get("mode") === "link" ? "link" : "signin";
  if (mode === "link" && !(await getSessionPayload())) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const req = newOAuthRequest(provider, mode, url.searchParams.get("remember") === "1");
  await saveOAuthRequest(req);
  return NextResponse.redirect(authorizationUrl(req));
}
