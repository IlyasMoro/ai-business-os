"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireRole, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireFeature } from "@/lib/plan-limits";
import { customerScope } from "@/lib/crm-access";
import { dueAfter, MAX_DELAY_DAYS, MAX_STEPS } from "@/lib/sequences";

/* Email sequences: owners and admins write them; anyone can put their own
   customers into one. They come with Automations (Growth and up). */

const LIST = "/dashboard/crm/sequences";

async function gate() {
  const session = await verifySession();
  await requireFeature(session.companyId, "automation", LIST);
  return session;
}

async function adminGate() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  await requireFeature(session.companyId, "automation", LIST);
  return session;
}

async function findSequence(companyId: string, sequenceId: string) {
  return db.emailSequence.findFirst({ where: { id: sequenceId, companyId }, include: { steps: { orderBy: { position: "asc" } } } });
}

function refresh(sequenceId?: string) {
  revalidatePath(LIST);
  if (sequenceId) revalidatePath(`${LIST}/${sequenceId}`);
}

// ---------- Writing sequences ----------

const NameSchema = z.string().trim().min(1).max(80);

export async function createSequence(formData: FormData) {
  const session = await adminGate();
  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) redirect(`${LIST}?error=invalid`);
  const sequence = await db.emailSequence.create({ data: { name: name.data, companyId: session.companyId, active: false } });
  await logAudit(session.companyId, session.userId, "sequence.created", "EmailSequence", sequence.id, { name: name.data });
  refresh();
  redirect(`${LIST}/${sequence.id}`);
}

export async function renameSequence(sequenceId: string, formData: FormData) {
  const session = await adminGate();
  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) redirect(`${LIST}/${sequenceId}?error=invalid`);
  await db.emailSequence.updateMany({ where: { id: sequenceId, companyId: session.companyId }, data: { name: name.data } });
  refresh(sequenceId);
  redirect(`${LIST}/${sequenceId}?saved=1`);
}

/** Turning a sequence on needs at least one email; off holds every email
 * until it is turned on again. */
export async function setSequenceActive(sequenceId: string, active: boolean) {
  const session = await adminGate();
  const sequence = await findSequence(session.companyId, sequenceId);
  if (!sequence) redirect(LIST);
  if (active && sequence.steps.length === 0) redirect(`${LIST}/${sequenceId}?error=sequence-empty`);
  await db.emailSequence.update({ where: { id: sequenceId }, data: { active } });
  await logAudit(session.companyId, session.userId, active ? "sequence.started" : "sequence.paused", "EmailSequence", sequenceId, {});
  refresh(sequenceId);
}

export async function deleteSequence(sequenceId: string) {
  const session = await adminGate();
  const sequence = await findSequence(session.companyId, sequenceId);
  if (!sequence) redirect(LIST);
  await db.emailSequence.delete({ where: { id: sequenceId } });
  await logAudit(session.companyId, session.userId, "sequence.deleted", "EmailSequence", sequenceId, { name: sequence.name });
  refresh();
  redirect(LIST);
}

const StepSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  delayDays: z.coerce.number().int().min(0).max(MAX_DELAY_DAYS),
});

function readStep(formData: FormData) {
  return StepSchema.safeParse({ subject: formData.get("subject"), body: formData.get("body"), delayDays: formData.get("delayDays") || 0 });
}

export async function addStep(sequenceId: string, formData: FormData) {
  const session = await adminGate();
  const sequence = await findSequence(session.companyId, sequenceId);
  if (!sequence) redirect(LIST);
  if (sequence.steps.length >= MAX_STEPS) redirect(`${LIST}/${sequenceId}?error=sequence-full`);
  const step = readStep(formData);
  if (!step.success) redirect(`${LIST}/${sequenceId}?error=step-invalid#new-step`);
  await db.emailSequenceStep.create({ data: { ...step.data, sequenceId, position: sequence.steps.length } });
  refresh(sequenceId);
  redirect(`${LIST}/${sequenceId}?saved=1`);
}

export async function updateStep(sequenceId: string, stepId: string, formData: FormData) {
  const session = await adminGate();
  const sequence = await findSequence(session.companyId, sequenceId);
  if (!sequence?.steps.some((s) => s.id === stepId)) redirect(LIST);
  const step = readStep(formData);
  if (!step.success) redirect(`${LIST}/${sequenceId}?error=step-invalid`);
  await db.emailSequenceStep.update({ where: { id: stepId }, data: step.data });
  refresh(sequenceId);
  redirect(`${LIST}/${sequenceId}?saved=1`);
}

/** Removes an email. Customers already past it carry on with the next one. */
export async function deleteStep(sequenceId: string, stepId: string) {
  const session = await adminGate();
  const sequence = await findSequence(session.companyId, sequenceId);
  if (!sequence) redirect(LIST);
  const index = sequence.steps.findIndex((s) => s.id === stepId);
  if (index < 0) redirect(`${LIST}/${sequenceId}`);
  const rest = sequence.steps.filter((s) => s.id !== stepId);
  await db.$transaction([
    db.emailSequenceStep.delete({ where: { id: stepId } }),
    ...rest.map((s, position) => db.emailSequenceStep.update({ where: { id: s.id }, data: { position } })),
    // Anyone already past the removed email moves back one, so nobody skips a step.
    db.sequenceEnrollment.updateMany({ where: { sequenceId, sent: { gt: index } }, data: { sent: { decrement: 1 } } }),
  ]);
  refresh(sequenceId);
}

// ---------- Customers in a sequence ----------

/** Starts (or restarts) the sequence for these customers: the ones with an
 * email who haven't unsubscribed and aren't in it already. */
async function enroll(companyId: string, userId: string, sequenceId: string, customerIds: string[]) {
  const sequence = await findSequence(companyId, sequenceId);
  if (!sequence || sequence.steps.length === 0) return { added: 0, skipped: customerIds.length, sequence };
  const customers = await db.customer.findMany({
    where: { companyId, id: { in: customerIds }, email: { not: null }, emailOptOut: false, ...(await customerScope()) },
    select: { id: true, sequenceEnrollments: { where: { sequenceId }, select: { id: true, status: true } } },
  });
  const now = new Date();
  const start = { status: "ACTIVE" as const, sent: 0, nextSendAt: dueAfter(now, sequence.steps[0].delayDays), lastSentAt: null, endedAt: null, endReason: null, enrolledById: userId };
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

/** From a customer's page. */
export async function enrollCustomer(formData: FormData) {
  const session = await gate();
  const customerId = String(formData.get("customerId") ?? "");
  const sequenceId = String(formData.get("sequenceId") ?? "");
  const back = `/dashboard/crm/${customerId}`;
  const { added, sequence } = await enroll(session.companyId, session.userId, sequenceId, [customerId]);
  if (!sequence) redirect(`${back}?error=invalid`);
  if (added === 0) redirect(`${back}?error=enroll-skipped#sequences`);
  await db.crmActivity.create({
    data: { type: "NOTE", body: `Added to the email sequence "${sequence.name}".`, companyId: session.companyId, customerId, authorId: session.userId },
  });
  refresh(sequenceId);
  revalidatePath(back);
  redirect(`${back}?enrolled=1#sequences`);
}

/** From a sequence's page: everyone with a tag, or every lead. */
export async function enrollGroup(sequenceId: string, formData: FormData) {
  const session = await gate();
  const group = String(formData.get("group") ?? "");
  const where =
    group === "leads"
      ? { status: "LEAD" as const }
      : group.startsWith("tag:")
        ? { tags: { some: { id: group.slice(4) } } }
        : null;
  if (!where) redirect(`${LIST}/${sequenceId}?error=invalid`);
  const customers = await db.customer.findMany({ where: { companyId: session.companyId, ...where, ...(await customerScope()) }, select: { id: true }, take: 2000 });
  const { added, skipped } = await enroll(session.companyId, session.userId, sequenceId, customers.map((c) => c.id));
  await logAudit(session.companyId, session.userId, "sequence.enrolled", "EmailSequence", sequenceId, { added, skipped });
  refresh(sequenceId);
  redirect(`${LIST}/${sequenceId}?added=${added}&skipped=${skipped}`);
}

export async function stopEnrollment(enrollmentId: string) {
  const session = await gate();
  const enrollment = await db.sequenceEnrollment.findFirst({
    where: { id: enrollmentId, companyId: session.companyId, customer: await customerScope() },
    select: { sequenceId: true, customerId: true },
  });
  if (!enrollment) return;
  const me = await db.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  await db.sequenceEnrollment.updateMany({
    where: { id: enrollmentId, status: "ACTIVE" },
    data: { status: "STOPPED", endReason: `Stopped by ${me?.name ?? "a team member"}`, endedAt: new Date(), nextSendAt: null },
  });
  refresh(enrollment.sequenceId);
  revalidatePath(`/dashboard/crm/${enrollment.customerId}`);
}
