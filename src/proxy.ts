import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

// The signed in app lives under /dashboard, so only that is gated here.
// Everything else is public: the marketing pages, robots.txt, sitemap.xml,
// the code generated icons and the customer facing secret links (/q/ quotes,
// /f/ lead forms, /u/ unsubscribe). Unknown paths fall through to the 404
// page instead of bouncing to /login. Dashboard pages also check the session
// against the database themselves (verifySession in lib/dal.ts, called by
// the dashboard layout), so this redirect is the first gate, not the only one.
function isPrivateRoute(path: string) {
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

// Routes for signed out visitors only — a logged in user is redirected to
// the dashboard instead of seeing them.
const authRoutes = ["/login", "/register", "/forgot-password"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAuthRoute =
    authRoutes.includes(path) || path.startsWith("/reset-password/") || path.startsWith("/invite/");

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (isPrivateRoute(path) && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isAuthRoute && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Exposed so Server Components (which don't otherwise know the current
  // path) can decide whether to apply path-specific logic, e.g. letting the
  // billing page render even when the rest of the dashboard is blocked for
  // an expired trial.
  const res = NextResponse.next();
  res.headers.set("x-pathname", path);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
