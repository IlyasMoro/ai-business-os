import { describe, it, expect } from "vitest";
import {
  base32Decode,
  base32Encode,
  currentStep,
  hashRecoveryCode,
  matchTotp,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  totpCode,
} from "@/lib/totp";

// RFC 6238 appendix B test key: ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("round trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("matches the RFC 6238 SHA1 test vectors (last 6 digits)", () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("accepts the current code and one step of drift, nothing further", () => {
    const secret = newTotpSecret();
    const nowMs = 1_800_000_000_000;
    const step = currentStep(nowMs);
    expect(matchTotp(secret, totpCode(secret, step), { nowMs })).toBe(step);
    expect(matchTotp(secret, totpCode(secret, step - 1), { nowMs })).toBe(step - 1);
    expect(matchTotp(secret, totpCode(secret, step + 1), { nowMs })).toBe(step + 1);
    expect(matchTotp(secret, totpCode(secret, step - 3), { nowMs })).toBeNull();
  });

  it("refuses a code that was already used, and junk", () => {
    const secret = newTotpSecret();
    const nowMs = 1_800_000_000_000;
    const step = currentStep(nowMs);
    const code = totpCode(secret, step);
    expect(matchTotp(secret, code, { nowMs, lastStep: step })).toBeNull();
    expect(matchTotp(secret, "12345", { nowMs })).toBeNull();
    expect(matchTotp(secret, "abcdef", { nowMs })).toBeNull();
    expect(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { nowMs })).toBe(step);
  });

  it("builds an otpauth link the apps understand", () => {
    const url = otpauthUrl({ secret: "ABC", account: "me@shop.example" });
    expect(url.startsWith("otpauth://totp/AIBOS%3Ame%40shop.example?")).toBe(true);
    expect(url).toContain("secret=ABC");
    expect(url).toContain("issuer=AIBOS");
  });

  it("makes ten distinct recovery codes and hashes them loosely", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{5} [a-z2-9]{5}$/);
    expect(hashRecoveryCode("ABCDE FGHJK")).toBe(hashRecoveryCode("abcdefghjk"));
  });
});
