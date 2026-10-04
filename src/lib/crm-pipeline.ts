/* CRM pipeline rules shared by the deals board, deal pages, customer pages
   and tests. No database access here. */

export type DealStage = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export type LeadSource = "WEBSITE" | "REFERRAL" | "CAMPAIGN" | "EVENT" | "OUTREACH" | "SOCIAL" | "OTHER";
export type CrmActivityType = "NOTE" | "CALL" | "MEETING" | "EMAIL" | "WHATSAPP";

/** Board columns, left to right. `probability` is the default chance of
 * winning when a deal enters the stage; it can be changed per deal. */
export const DEAL_STAGES: { id: DealStage; label: string; probability: number; open: boolean }[] = [
  { id: "NEW", label: "New", probability: 10, open: true },
  { id: "QUALIFIED", label: "Qualified", probability: 30, open: true },
  { id: "PROPOSAL", label: "Proposal", probability: 50, open: true },
  { id: "NEGOTIATION", label: "Negotiation", probability: 75, open: true },
  { id: "WON", label: "Won", probability: 100, open: false },
  { id: "LOST", label: "Lost", probability: 0, open: false },
];

export const DEAL_STAGE_IDS = DEAL_STAGES.map((s) => s.id);

export function stageInfo(stage: DealStage) {
  return DEAL_STAGES.find((s) => s.id === stage)!;
}

export function isOpenStage(stage: DealStage): boolean {
  return stageInfo(stage).open;
}

export const LEAD_SOURCES: { id: LeadSource; label: string }[] = [
  { id: "WEBSITE", label: "Website" },
  { id: "REFERRAL", label: "Referral" },
  { id: "CAMPAIGN", label: "Campaign" },
  { id: "EVENT", label: "Event" },
  { id: "OUTREACH", label: "Outreach" },
  { id: "SOCIAL", label: "Social media" },
  { id: "OTHER", label: "Other" },
];

export const LEAD_SOURCE_IDS = LEAD_SOURCES.map((s) => s.id);

export function sourceLabel(source: LeadSource | null | undefined): string | null {
  return source ? (LEAD_SOURCES.find((s) => s.id === source)?.label ?? null) : null;
}

export const ACTIVITY_TYPES: { id: CrmActivityType; label: string; verb: string }[] = [
  { id: "NOTE", label: "Note", verb: "added a note" },
  { id: "CALL", label: "Call", verb: "logged a call" },
  { id: "MEETING", label: "Meeting", verb: "logged a meeting" },
  { id: "EMAIL", label: "Email", verb: "logged an email" },
  { id: "WHATSAPP", label: "WhatsApp", verb: "sent a WhatsApp" },
];

export const ACTIVITY_TYPE_IDS = ACTIVITY_TYPES.map((t) => t.id);

export function activityInfo(type: CrmActivityType) {
  return ACTIVITY_TYPES.find((t) => t.id === type)!;
}

type DealLike = { value: number; stage: DealStage; probability: number };

/** Value and count per stage, plus open pipeline totals: the plain value and
 * the weighted value (each deal's value times its chance of winning). */
export function pipelineSummary(deals: DealLike[]) {
  const byStage = Object.fromEntries(DEAL_STAGE_IDS.map((id) => [id, { count: 0, value: 0 }])) as Record<
    DealStage,
    { count: number; value: number }
  >;
  let openValue = 0;
  let weightedValue = 0;
  let openCount = 0;
  for (const deal of deals) {
    byStage[deal.stage].count += 1;
    byStage[deal.stage].value += deal.value;
    if (isOpenStage(deal.stage)) {
      openCount += 1;
      openValue += deal.value;
      weightedValue += (deal.value * deal.probability) / 100;
    }
  }
  const won = byStage.WON.count;
  const closed = won + byStage.LOST.count;
  return {
    byStage,
    openCount,
    openValue,
    weightedValue: Math.round(weightedValue * 100) / 100,
    /** Share of closed deals that were won, 0 to 100, or null before any close. */
    winRate: closed === 0 ? null : Math.round((won / closed) * 100),
  };
}

/** Position for a card dropped between two others (or at an end), so the
 * board order can change without renumbering the whole column. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "done";

/** Where a follow-up belongs on a list: done, overdue (due before today),
 * today, or later. "Today" is the local calendar day of `now`. */
export function followUpBucket(followUp: { dueAt: Date; doneAt: Date | null }, now = new Date()): FollowUpBucket {
  if (followUp.doneAt) return "done";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  if (followUp.dueAt < startOfToday) return "overdue";
  if (followUp.dueAt < startOfTomorrow) return "today";
  return "upcoming";
}
