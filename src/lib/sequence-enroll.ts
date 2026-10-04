import "server-only";
import { db } from "@/lib/db";
import { dueAfter } from "@/lib/sequences";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Starts (or restarts) a sequence for these customers: the ones with an
 * email who haven't unsubscribed and aren't in it already. `scope` narrows
 * the customers further (an employee's own customers). Used by the
 * sequence buttons and by CRM rules.
 */
export async function enrollCustomers(
  companyId: string,
  userId: string | null,
  sequenceId: string,
  customerIds: string[],
  scope: Prisma.CustomerWhereInput = {}
) {
  const sequence = await db.emailSequence.findFirst({ where: { id: sequenceId, companyId }, include: { steps: { orderBy: { position: "asc" } } } });
  if (!sequence || sequence.steps.length === 0) return { added: 0, skipped: customerIds.length, sequence };
  const customers = await db.customer.findMany({
    where: { companyId, id: { in: customerIds }, email: { not: null }, emailOptOut: false, ...scope },
    select: { id: true, sequenceEnrollments: { where: { sequenceId }, select: { id: true, status: true } } },
  });
  const now = new Date();
  const start = {
    status: "ACTIVE" as const,
    sent: 0,
    nextSendAt: dueAfter(now, sequence.steps[0].delayDays),
    lastSentAt: null,
    endedAt: null,
    endReason: null,
    enrolledById: userId,
  };
  let added = 0;
  for (const c of customers) {
    const existing = c.sequenceEnrollments[0];
    if (existing?.status === "ACTIVE") continue;
    if (existing) await db.sequenceEnrollment.update({ where: { id: existing.id }, data: { ...start, createdAt: now } });
    else await db.sequenceEnrollment.create({ data: { ...start, sequenceId, customerId: c.id, companyId } });
    added += 1;
  }
  return { added, skipped: customerIds.length - added, sequence };
}
