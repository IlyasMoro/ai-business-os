import "server-only";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { bodyToHtml, dueAfter, renderTemplate } from "@/lib/sequences";
import { unsubscribeUrl } from "@/lib/unsubscribe";

/** Emails sent per cron run, across all companies, so one run stays short. */
const BATCH = 200;

async function end(id: string, status: "COMPLETED" | "STOPPED", endReason: string | null) {
  await db.sequenceEnrollment.update({ where: { id }, data: { status, endReason, endedAt: new Date(), nextSendAt: null } });
}

/**
 * Sends every sequence email that is due. Each enrollment is claimed before
 * sending (its nextSendAt is cleared in a conditional update), so a second
 * run at the same moment can't send the same email twice. A paused sequence
 * holds its emails until it is turned back on.
 */
export async function runSequences(): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const due = await db.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: now }, sequence: { active: true } },
    orderBy: { nextSendAt: "asc" },
    take: BATCH,
    include: {
      sequence: { select: { name: true, steps: { orderBy: { position: "asc" }, select: { delayDays: true, subject: true, body: true } } } },
      customer: { select: { id: true, name: true, email: true, company: true, emailOptOut: true } },
      enrolledBy: { select: { name: true } },
      companyRef: { select: { name: true } },
    },
  });

  const allowed = new Map<string, boolean>();
  let sent = 0;
  let failed = 0;

  for (const enrollment of due) {
    const { companyId, customer, sequence } = enrollment;
    if (!allowed.has(companyId)) allowed.set(companyId, await hasFeature(companyId, "automation"));
    if (!allowed.get(companyId)) continue;

    const step = sequence.steps[enrollment.sent];
    if (!step) {
      await end(enrollment.id, "COMPLETED", null);
      continue;
    }
    if (customer.emailOptOut) {
      await end(enrollment.id, "STOPPED", "Unsubscribed");
      continue;
    }
    if (!customer.email) {
      await end(enrollment.id, "STOPPED", "No email address");
      continue;
    }

    const claimed = await db.sequenceEnrollment.updateMany({
      where: { id: enrollment.id, status: "ACTIVE", nextSendAt: enrollment.nextSendAt },
      data: { nextSendAt: null },
    });
    if (claimed.count === 0) continue;

    const vars = {
      name: customer.name,
      company: customer.company,
      senderName: enrollment.enrolledBy?.name ?? enrollment.companyRef.name,
      myCompany: enrollment.companyRef.name,
    };
    const subject = renderTemplate(step.subject, vars);
    try {
      await sendEmailForCompany(companyId, {
        to: customer.email,
        subject,
        html: bodyToHtml(renderTemplate(step.body, vars), unsubscribeUrl(customer.id)),
      });
    } catch (err) {
      console.error(`[sequences] send failed for enrollment ${enrollment.id}:`, err);
      failed += 1;
      // Try again in an hour rather than dropping the email.
      await db.sequenceEnrollment.update({ where: { id: enrollment.id }, data: { nextSendAt: new Date(now.getTime() + 60 * 60 * 1000) } });
      continue;
    }

    const sentCount = enrollment.sent + 1;
    const next = sequence.steps[sentCount];
    await db.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: next
        ? { sent: sentCount, lastSentAt: now, nextSendAt: dueAfter(now, next.delayDays) }
        : { sent: sentCount, lastSentAt: now, status: "COMPLETED", endedAt: now },
    });
    await db.crmActivity.create({
      data: {
        type: "EMAIL",
        body: `Sequence "${sequence.name}", email ${sentCount} of ${sequence.steps.length}: ${subject}`,
        companyId,
        customerId: customer.id,
        authorId: enrollment.enrolledById,
      },
    });
    sent += 1;
  }

  return { sent, failed };
}

/** Ends a customer's active sequences because they wrote back. */
export async function stopSequencesOnReply(companyId: string, customerId: string) {
  await db.sequenceEnrollment.updateMany({
    where: { companyId, customerId, status: "ACTIVE" },
    data: { status: "REPLIED", endReason: "They replied", endedAt: new Date(), nextSendAt: null },
  });
}
