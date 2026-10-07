import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

/* Time based one time codes (RFC 6238, the standard Google Authenticator,
   Microsoft Authenticator and 1Password use): 6 digits, 30 second steps,
   HMAC SHA1. Pure apart from the clock and randomness, so it can be tested. */

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret, base32 (what the app's "enter a key" box takes). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const number = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return number.toString().padStart(DIGITS, "0");
}

/**
 * The step the code belongs to, allowing one step either side for clock
 * drift, or null. Steps at or before `lastStep` are refused so a code that
 * was already used cannot be replayed.
 */
export function matchTotp(secret: string, code: string, { nowMs = Date.now(), lastStep = null as number | null } = {}): number | null {
  const typed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(typed)) return null;
  const now = currentStep(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(typed))) return step;
  }
  return null;
}

/** The link an authenticator app reads from the QR code. */
export function otpauthUrl({ secret, account, issuer = "AIBOS" }: { secret: string; account: string; issuer?: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------- Recovery codes ----------

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Ten one time codes like "k7mq9 x2pfr", shown once when two step sign in is turned on. */
export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return `${chars.slice(0, 5)} ${chars.slice(5)}`;
  });
}

/** What is stored: a hash of the code without spaces or case. */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");
}
