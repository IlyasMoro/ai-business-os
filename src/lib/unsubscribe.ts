import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/* Unsubscribe links for sequence emails: /u/<customerId>.<signature>. The
   signature proves the link came from us, so nobody can unsubscribe another
   customer by guessing an id, and no token has to be stored. */

function signature(customerId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return createHmac("sha256", `${secret}:unsubscribe`).update(customerId).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(customerId: string): string {
  return `${customerId}.${signature(customerId)}`;
}

export function unsubscribeUrl(customerId: string): string | null {
  const base = process.env.APP_BASE_URL;
  return base ? `${base}/u/${unsubscribeToken(customerId)}` : null;
}

/** The customer id the token was made for, or null if it was tampered with. */
export function readUnsubscribeToken(token: string): string | null {
  const [customerId, sig] = token.split(".");
  if (!customerId || !sig) return null;
  const expected = Buffer.from(signature(customerId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? customerId : null;
}
