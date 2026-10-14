import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * Passkeys: sign in with the device's fingerprint, face or PIN (Windows
 * Hello, Face ID, Touch ID, an Android phone, a security key). The browser
 * proves the person holds the private key by signing a one time challenge;
 * only the public key is kept here.
 *
 * A passkey always asks the device to check the person (user verification
 * "required"), so it counts as two factors on its own: what they have (the
 * device) and who they are or what they know (the fingerprint, face or
 * PIN). That is why a passkey sign in skips the authenticator app step.
 */

export const PASSKEY_RP_NAME = "AIBOS";

/** The site the passkeys belong to. Passkeys only work on this exact
 *  address, which is what stops a look alike site from using them. */
export function passkeyRelyingParty() {
  const base = process.env.APP_BASE_URL;
  if (!base) throw new Error("APP_BASE_URL environment variable is not set");
  const url = new URL(base);
  return { rpID: url.hostname, origin: url.origin };
}

const CHALLENGE_COOKIE = "aibos_passkey";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type Purpose = "register" | "login";

/** Keeps a new challenge for five minutes and points this browser at it
 *  with a short lived cookie. Old challenges are swept out on the way. */
export async function saveChallenge(challenge: string, purpose: Purpose, userId?: string) {
  await db.passkeyChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const row = await db.passkeyChallenge.create({
    data: { challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  (await cookies()).set(CHALLENGE_COOKIE, row.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/passkey",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

/** Takes this browser's challenge and uses it up, so an answer can never be
 *  replayed. Null when there is none, it expired, or it was for something
 *  else (or, when adding a passkey, for someone else). */
export async function takeChallenge(purpose: Purpose, userId?: string): Promise<string | null> {
  const store = await cookies();
  const id = store.get(CHALLENGE_COOKIE)?.value;
  store.delete({ name: CHALLENGE_COOKIE, path: "/api/auth/passkey" });
  if (!id) return null;
  const row = await db.passkeyChallenge.findUnique({ where: { id } });
  if (!row || row.purpose !== purpose || (userId && row.userId !== userId)) return null;
  // Only one request can delete it, so two answers raced in can't both pass.
  const claimed = await db.passkeyChallenge.deleteMany({ where: { id, expiresAt: { gt: new Date() } } });
  return claimed.count === 1 ? row.challenge : null;
}

/** A default name for a new passkey from the browser's description of the
 *  device; the person can change it before saving. */
export function guessPasskeyName(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows computer";
  if (/Linux/i.test(ua)) return "Linux computer";
  return "Passkey";
}

