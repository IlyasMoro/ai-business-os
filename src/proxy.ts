import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

// Routes anyone can view, logged in or not, with no redirect either way.
const openRoutes = ["/", "/terms", "/privacy", "/pricing"];
// Routes for signed out visitors only — a logged in user is redirected to
// the dashboard instead of seeing them.
const authRoutes = ["/login", "/register", "/forgot-password"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isOpenRoute = openRoutes.includes(path);
  const isAuthRoute = authRoutes.includes(path) || path.startsWith("/reset-password/");

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (!isOpenRoute && !isAuthRoute && !session?.userId) {
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
