import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/* Encrypts small secrets kept in the database (authenticator app keys) with
   AES-256-GCM. The key is derived from JWT_SECRET under its own label, so a
   database copy alone cannot read them. Format: v1.<iv>.<tag>.<data>, base64url. */

function key(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return createHash("sha256").update(`aibos secret box v1:${secret}`).digest();
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The plain secret, or null when the box was tampered with or the key changed. */
export function openSecret(sealed: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
