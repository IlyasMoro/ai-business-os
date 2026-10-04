import "server-only";
import { db } from "@/lib/db";
import { isOpenStage } from "@/lib/crm-pipeline";
import { leadScore, type LeadFacts, type ScoreReason } from "@/lib/lead-score";

const DAY = 24 * 60 * 60 * 1000;
const CHUNK = 500;

const later = (a: Date | null, b: Date | null | undefined) => (!b ? a : !a || b > a ? b : a);

/** Gathers each customer's facts (activities, deals, quotes, orders) in a
 * handful of grouped queries, whatever the number of customers. */
async function factsFor(companyId: string, ids: string[], now: Date): Promise<Map<string, LeadFacts>> {
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const quarterAgo = new Date(now.getTime() - 90 * DAY);
  const [customers, recent, lastActivity, deals, quotes, lastOrder, recentOrders] = await Promise.all([
    db.customer.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, source: true, email: true, phone: true, emailOptOut: true } }),
    db.crmActivity.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, occurredAt: { gte: monthAgo } }, _count: { _all: true } }),
    db.crmActivity.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _max: { occurredAt: true } }),
    db.deal.findMany({ where: { customerId: { in: ids } }, select: { customerId: true, stage: true, probability: true, updatedAt: true } }),
    db.quote.findMany({ where: { customerId: { in: ids } }, select: { customerId: true, status: true, validUntil: true, updatedAt: true } }),
    db.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _max: { createdAt: true } }),
    db.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, createdAt: { gte: quarterAgo } }, _count: { _all: true } }),
  ]);

  const facts = new Map<string, LeadFacts>();
  for (const c of customers) {
    facts.set(c.id, {
      source: c.source,
      hasEmail: Boolean(c.email),
      hasPhone: Boolean(c.phone),
      emailOptOut: c.emailOptOut,
      recentActivities: 0,
      lastTouchAt: null,
      openDeals: 0,
      bestOpenProbability: 0,
      wonDeals: 0,
      lostDeals: 0,
      openQuotes: 0,
      acceptedQuotes: 0,
      recentOrders: 0,
    });
  }
  for (const row of recent) {
    const f = facts.get(row.customerId);
    if (f) f.recentActivities = row._count._all;
  }
  for (const row of lastActivity) {
    const f = facts.get(row.customerId);
    if (f) f.lastTouchAt = later(f.lastTouchAt, row._max.occurredAt);
  }
  for (const deal of deals) {
    const f = facts.get(deal.customerId);
    if (!f) continue;
    f.lastTouchAt = later(f.lastTouchAt, deal.updatedAt);
    if (isOpenStage(deal.stage)) {
      f.openDeals += 1;
      f.bestOpenProbability = Math.max(f.bestOpenProbability, deal.probability);
    } else if (deal.stage === "WON") f.wonDeals += 1;
    else f.lostDeals += 1;
  }
  for (const quote of quotes) {
    const f = facts.get(quote.customerId);
    if (!f) continue;
    f.lastTouchAt = later(f.lastTouchAt, quote.updatedAt);
    if (quote.status === "SENT" && (!quote.validUntil || quote.validUntil >= now)) f.openQuotes += 1;
    if (quote.status === "ACCEPTED") f.acceptedQuotes += 1;
  }
  for (const row of lastOrder) {
    const f = facts.get(row.customerId);
    if (f) f.lastTouchAt = later(f.lastTouchAt, row._max.createdAt);
  }
  for (const row of recentOrders) {
    const f = facts.get(row.customerId);
    if (f) f.recentOrders = row._count._all;
  }
  return facts;
}

/**
 * Works out the score for these customers (every customer of the company
 * when `ids` is left out) and saves the ones that changed. Returns each
 * score with its reasons, for the customer page.
 */
export async function refreshLeadScores(
  companyId: string,
  ids?: string[]
): Promise<Map<string, { score: number; reasons: ScoreReason[] }>> {
  const now = new Date();
  const all = ids ?? (await db.customer.findMany({ where: { companyId }, select: { id: true } })).map((c) => c.id);
  const results = new Map<string, { score: number; reasons: ScoreReason[] }>();

  for (let i = 0; i < all.length; i += CHUNK) {
    const chunk = all.slice(i, i + CHUNK);
    const [facts, current] = await Promise.all([
      factsFor(companyId, chunk, now),
      db.customer.findMany({ where: { companyId, id: { in: chunk } }, select: { id: true, leadScore: true } }),
    ]);
    const stored = new Map(current.map((c) => [c.id, c.leadScore]));
    const changed = new Map<number, string[]>();
    for (const [id, f] of facts) {
      const result = leadScore(f, now);
      results.set(id, result);
      if (stored.get(id) !== result.score) {
        if (!changed.has(result.score)) changed.set(result.score, []);
        changed.get(result.score)!.push(id);
      }
    }
    // One update per distinct score rather than one per customer.
    for (const [score, changedIds] of changed) {
      await db.customer.updateMany({ where: { companyId, id: { in: changedIds } }, data: { leadScore: score } });
    }
  }
  return results;
}

/** Refreshes one customer's score after something changed; never throws,
 * since a score is not worth failing the user's action over. */
export async function touchLeadScore(companyId: string, customerId: string | null | undefined) {
  if (!customerId) return;
  try {
    await refreshLeadScores(companyId, [customerId]);
  } catch (err) {
    console.error(`[lead-score] refresh failed for customer ${customerId}:`, err);
  }
}
