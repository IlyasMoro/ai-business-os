import type { ReportFrequency } from "@/generated/prisma/client";

const REPORT_INTERVAL_MS: Record<Exclude<ReportFrequency, "OFF">, number> = {
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  QUARTERLY: 90 * 24 * 60 * 60 * 1000,
};

export function isReportDue(frequency: ReportFrequency, lastSentAt: Date | null, now: Date = new Date()): boolean {
  if (frequency === "OFF") return false;
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= REPORT_INTERVAL_MS[frequency];
}
