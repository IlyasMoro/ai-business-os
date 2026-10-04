import { Badge } from "@/components/ui-dark/badge";
import { QUOTE_STATUS_LABELS, type QuoteDisplayStatus } from "@/lib/quotes";

export const QUOTE_TONE = {
  DRAFT: "slate",
  SENT: "blue",
  EXPIRED: "yellow",
  ACCEPTED: "green",
  DECLINED: "red",
} as const;

export function QuoteStatusBadge({ status }: { status: QuoteDisplayStatus }) {
  return <Badge tone={QUOTE_TONE[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

export function money(n: number, cents = false) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}

export function shortDate(date: Date) {
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
