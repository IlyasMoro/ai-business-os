import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headersList.get("x-real-ip") ?? "unknown";
}

/**
 * DB-backed sliding-window rate limiter, keyed by an arbitrary string
 * (e.g. `login:<ip>`). DB-backed rather than in-memory because serverless
 * function instances don't share memory between invocations.
 */
export async function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  // Opportunistic cleanup of this key's stale rows so the table doesn't grow
  // unbounded without needing a separate cleanup job.
  await db.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
  if (count >= max) {
    return false;
  }

  await db.rateLimitHit.create({ data: { key } });
  return true;
}
