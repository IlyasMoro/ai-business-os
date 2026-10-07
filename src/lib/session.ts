import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type SessionPayload = {
  userId: string;
  companyId: string;
  role: "OWNER" | "ADMIN" | "EMPLOYEE";
  name: string;
  email: string;
  /** "Keep me signed in": 30 days on this device. Otherwise the sign in
      ends when the browser closes, and after 12 hours at the latest. */
  remember?: boolean;
  /** Issued at, in seconds; set by encrypt(). */
  iat?: number;
};

const secretKey = process.env.JWT_SECRET;
if (!secretKey) {
  throw new Error("JWT_SECRET environment variable is not set");
}
const encodedKey = new TextEncoder().encode(secretKey);

const SESSION_COOKIE = "session";
const REMEMBER_DURATION = "30d";
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SHORT_DURATION = "12h";

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.remember ? REMEMBER_DURATION : SHORT_DURATION)
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined = ""
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    // Second step tickets share the key but are not sessions.
    if (payload.purpose) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** "Now" rounded down to the second, matching a token's `iat`. Stored as
 * sessionsValidAfter it rejects every older sign-in, while a session
 * created right after (same second) stays valid. */
export function sessionCutoffNow(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/**
 * Signs in on this device. `remember` left out (renaming yourself, changing
 * the password) keeps whatever the current sign in chose.
 */
export async function createSession(payload: SessionPayload) {
  const cookieStore = await cookies();
  const remember = payload.remember ?? (await decrypt(cookieStore.get(SESSION_COOKIE)?.value))?.remember ?? false;
  const session = await encrypt({ ...payload, remember });

  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // No expiry: a browser session cookie, gone when the browser closes.
    ...(remember ? { expires: new Date(Date.now() + REMEMBER_DURATION_MS) } : {}),
    sameSite: "lax",
    path: "/",
  });
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(session);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ---------- Second step ticket ----------

/* After a correct password (or a Google / Microsoft sign in) for someone
   with two step sign in, this short lived cookie remembers who passed the
   first step until they type their code at /login/verify. It is not a
   session: decrypt() refuses it. */

const SECOND_STEP_COOKIE = "signin_second_step";
const SECOND_STEP_MINUTES = 10;

export type SecondStepTicket = { userId: string; remember: boolean; via: "password" | "google" | "microsoft" };

export async function startSecondStep(ticket: SecondStepTicket) {
  const token = await new SignJWT({ ...ticket, purpose: "second-step" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SECOND_STEP_MINUTES}m`)
    .sign(encodedKey);
  const cookieStore = await cookies();
  cookieStore.set(SECOND_STEP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: SECOND_STEP_MINUTES * 60,
    sameSite: "lax",
    path: "/",
  });
}

export async function readSecondStep(): Promise<SecondStepTicket | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SECOND_STEP_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    if (payload.purpose !== "second-step" || typeof payload.userId !== "string") return null;
    const via = payload.via === "google" || payload.via === "microsoft" ? payload.via : "password";
    return { userId: payload.userId, remember: payload.remember === true, via };
  } catch {
    return null;
  }
}

export async function endSecondStep() {
  const cookieStore = await cookies();
  cookieStore.delete(SECOND_STEP_COOKIE);
}

export { SESSION_COOKIE };
