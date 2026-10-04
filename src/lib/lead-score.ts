/* Lead scoring: how warm a customer is, 0 to 100, from plain rules anyone
   can check. Each rule adds (or takes off) points and says why, so the
   customer page can show the reasons. No database access here; the facts
   are gathered by lib/lead-score-data.ts. */

import type { LeadSource } from "@/lib/crm-pipeline";

export type LeadFacts = {
  source: LeadSource | null;
  hasEmail: boolean;
  hasPhone: boolean;
  emailOptOut: boolean;
  /** Calls, meetings, emails and notes in the last 30 days. */
  recentActivities: number;
  /** The last time anything happened with them: activity, deal, quote or order. */
  lastTouchAt: Date | null;
  openDeals: number;
  /** The best win chance among open deals, 0 to 100. */
  bestOpenProbability: number;
  wonDeals: number;
  lostDeals: number;
  /** Quotes sent and still waiting on an answer. */
  openQuotes: number;
  acceptedQuotes: number;
  /** Orders in the last 90 days. */
  recentOrders: number;
};

export type ScoreReason = { label: string; points: number };

const DAY = 24 * 60 * 60 * 1000;

const SOURCE_POINTS: Record<LeadSource, number> = {
  REFERRAL: 10,
  WEBSITE: 8,
  EVENT: 6,
  CAMPAIGN: 4,
  SOCIAL: 4,
  OUTREACH: 2,
  OTHER: 0,
};

export function leadScore(facts: LeadFacts, now = new Date()): { score: number; reasons: ScoreReason[] } {
  const reasons: ScoreReason[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) reasons.push({ label, points });
  };

  // Recent contact counts most: a quiet customer cools down.
  if (facts.lastTouchAt) {
    const days = (now.getTime() - facts.lastTouchAt.getTime()) / DAY;
    if (days <= 7) add("In touch this week", 20);
    else if (days <= 30) add("In touch this month", 12);
    else if (days <= 90) add("In touch in the last 3 months", 5);
  }
  if (facts.recentActivities > 0) {
    const n = facts.recentActivities;
    add(`${n} ${n === 1 ? "activity" : "activities"} in the last 30 days`, Math.min(20, n * 5));
  }

  if (facts.openDeals > 0) {
    add(facts.openDeals === 1 ? "Has an open deal" : `Has ${facts.openDeals} open deals`, 10);
    add(`Best open deal is at ${facts.bestOpenProbability}% to win`, Math.round(Math.min(100, facts.bestOpenProbability) * 0.15));
  }
  if (facts.openQuotes > 0) add("Has a quote waiting on an answer", 10);
  if (facts.acceptedQuotes > 0) add("Has accepted a quote before", 10);
  if (facts.recentOrders > 0) add("Ordered in the last 90 days", 15);
  if (facts.wonDeals > 0) add("Has won deals", 5);
  if (facts.lostDeals > 0 && facts.openDeals === 0 && facts.wonDeals === 0) add("Only lost deals so far", -5);

  if (facts.source) add(`Came from ${facts.source === "SOCIAL" ? "social media" : facts.source.toLowerCase()}`, SOURCE_POINTS[facts.source]);
  if (facts.hasEmail) add("Has an email address", 3);
  if (facts.hasPhone) add("Has a phone number", 2);
  if (facts.emailOptOut) add("Unsubscribed from emails", -10);

  const total = reasons.reduce((sum, r) => sum + r.points, 0);
  return { score: Math.max(0, Math.min(100, total)), reasons };
}

export type ScoreBand = "hot" | "warm" | "cool";

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cool";
}

export const SCORE_BANDS: Record<ScoreBand, { label: string; tone: "red" | "yellow" | "slate" }> = {
  hot: { label: "Hot", tone: "red" },
  warm: { label: "Warm", tone: "yellow" },
  cool: { label: "Cool", tone: "slate" },
};
