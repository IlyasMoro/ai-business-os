"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  ACTIVITY_TYPE_IDS,
  DEAL_STAGE_IDS,
  positionBetween,
  stageInfo,
  type CrmActivityType,
  type DealStage,
} from "@/lib/crm-pipeline";
import { customerScope, dealScope, followUpScope } from "@/lib/crm-access";
import { touchLeadScore } from "@/lib/lead-score-data";
import { dealStageChanged } from "@/lib/crm-rules-runner";
import { QuoteItemSchema, quoteTotal } from "@/lib/quotes";
import type { QuoteItemFormState } from "@/lib/actions/quotes";

/* Deals (the pipeline board), activity history and follow-ups. Every record
   is scoped to the signed-in company; ids from forms are checked before use. */

const BOARD = "/dashboard/crm/deals";

/** Where to go back to after a form: only CRM pages, so a form can't send
 * people anywhere else. */
function backTo(formData: FormData, fallback: string) {
  const back = formData.get("back");
  return typeof back === "string" && back.startsWith("/dashboard/crm") ? back : fallback;
}

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

async function companyCustomer(companyId: string, customerId: string | undefined) {
  if (!customerId) return null;
  return db.customer.findFirst({ where: { id: customerId, companyId, ...(await customerScope()) }, select: { id: true } });
}

async function companyUser(companyId: string, userId: string | undefined) {
  if (!userId) return null;
  return db.user.findFirst({ where: { id: userId, companyId }, select: { id: true } });
}

async function companyDeal(companyId: string, dealId: string | undefined) {
  if (!dealId) return null;
  return db.deal.findFirst({ where: { id: dealId, companyId, ...(await dealScope()) }, select: { id: true, customerId: true } });
}

/** Refreshes the CRM pages and the customer's lead score after a change. */
async function revalidateCrm(companyId: string, customerId?: string, dealId?: string) {
  await touchLeadScore(companyId, customerId);
  revalidatePath(BOARD);
  revalidatePath("/dashboard/crm");
  if (customerId) revalidatePath(`/dashboard/crm/${customerId}`);
  if (dealId) revalidatePath(`${BOARD}/${dealId}`);
  revalidatePath("/dashboard", "layout");
}

/** Won and lost deals get a close date; reopening clears it. */
function closingFields(stage: DealStage) {
  return { closedAt: stageInfo(stage).open ? null : new Date() };
}

// ---------- Deals ----------

const DealSchema = z.object({
  title: z.string().trim().min(1).max(200),
  value: z.coerce.number().min(0).max(1_000_000_000),
  stage: z.enum(DEAL_STAGE_IDS as [DealStage, ...DealStage[]]),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  lostReason: z.string().trim().max(300).optional(),
});

function parseDeal(formData: FormData) {
  return DealSchema.safeParse({
    title: formData.get("title"),
    value: formData.get("value") || 0,
    stage: formData.get("stage") || "NEW",
    probability: formData.get("probability") || undefined,
    expectedClose: text(formData, "expectedClose"),
    lostReason: text(formData, "lostReason"),
  });
}

function dateOrNull(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createDeal(formData: FormData) {
  const session = await verifySession();
  const back = backTo(formData, BOARD);
  const parsed = parseDeal(formData);
  if (!parsed.success) redirect(`${back}?error=invalid`);
  const customer = await companyCustomer(session.companyId, text(formData, "customerId"));
  if (!customer) redirect(`${back}?error=invalid`);
  const ownerId = text(formData, "ownerId");
  if (ownerId && !(await companyUser(session.companyId, ownerId))) redirect(`${back}?error=invalid`);

  const { stage, probability, expectedClose, lostReason, ...rest } = parsed.data;
  // New cards go to the top of their column.
  const top = await db.deal.findFirst({
    where: { companyId: session.companyId, stage },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const deal = await db.deal.create({
    data: {
      ...rest,
      stage,
      probability: probability ?? stageInfo(stage).probability,
      expectedClose: dateOrNull(expectedClose),
      lostReason: stage === "LOST" ? lostReason : null,
      position: positionBetween(null, top?.position ?? null),
      ...closingFields(stage),
      companyId: session.companyId,
      customerId: customer.id,
      ownerId: ownerId ?? session.userId,
    },
  });
  await logAudit(session.companyId, session.userId, "deal.created", "Deal", deal.id, { stage, value: rest.value });
  await dealStageChanged(session.companyId, deal, stage);
  await revalidateCrm(session.companyId, customer.id);
  redirect(back === BOARD ? `${BOARD}/${deal.id}` : back);
}

export async function updateDeal(dealId: string, formData: FormData) {
  const session = await verifySession();
  const back = `${BOARD}/${dealId}`;
  const current = await db.deal.findFirst({
    where: { id: dealId, companyId: session.companyId, ...(await dealScope()) },
    select: { stage: true, customerId: true, probability: true },
  });
  if (!current) redirect(BOARD);
  const parsed = parseDeal(formData);
  if (!parsed.success) redirect(`${back}?error=invalid`);
  const ownerId = text(formData, "ownerId");
  if (ownerId && !(await companyUser(session.companyId, ownerId))) redirect(`${back}?error=invalid`);

  const { stage, probability, expectedClose, lostReason, ...rest } = parsed.data;
  const stageChanged = stage !== current.stage;
  await db.deal.update({
    where: { id: dealId, companyId: session.companyId },
    data: {
      ...rest,
      stage,
      // A new stage brings its usual chance, unless the chance was changed in the same save.
      probability:
        stageChanged && (probability === undefined || probability === current.probability)
          ? stageInfo(stage).probability
          : probability,
      expectedClose: dateOrNull(expectedClose),
      lostReason: stage === "LOST" ? (lostReason ?? null) : null,
      ownerId: ownerId ?? null,
      ...(stageChanged ? closingFields(stage) : {}),
    },
  });
  if (stageChanged) {
    await logAudit(session.companyId, session.userId, "deal.stage_changed", "Deal", dealId, { from: current.stage, to: stage });
    await dealStageChanged(session.companyId, { id: dealId, customerId: current.customerId }, stage);
  }
  await revalidateCrm(session.companyId, current.customerId, dealId);
  redirect(`${back}?saved=1`);
}

/** Drag and drop on the board: a new stage and a place between two cards. */
export async function moveDeal(dealId: string, stage: DealStage, beforeId: string | null, afterId: string | null) {
  const session = await verifySession();
  if (!DEAL_STAGE_IDS.includes(stage)) return;
  const deal = await db.deal.findFirst({ where: { id: dealId, companyId: session.companyId, ...(await dealScope()) }, select: { stage: true, customerId: true } });
  if (!deal) return;

  const neighbours = await db.deal.findMany({
    where: { companyId: session.companyId, id: { in: [beforeId, afterId].filter((v): v is string => Boolean(v)) } },
    select: { id: true, position: true },
  });
  const pos = (id: string | null) => (id ? (neighbours.find((n) => n.id === id)?.position ?? null) : null);
  const stageChanged = stage !== deal.stage;

  await db.deal.update({
    where: { id: dealId, companyId: session.companyId },
    data: {
      stage,
      position: positionBetween(pos(beforeId), pos(afterId)),
      ...(stageChanged
        ? { probability: stageInfo(stage).probability, ...closingFields(stage), ...(stage === "LOST" ? {} : { lostReason: null }) }
        : {}),
    },
  });
  if (stageChanged) {
    await logAudit(session.companyId, session.userId, "deal.stage_changed", "Deal", dealId, { from: deal.stage, to: stage });
    await dealStageChanged(session.companyId, { id: dealId, customerId: deal.customerId }, stage);
  }
  await revalidateCrm(session.companyId, deal.customerId, dealId);
}

export async function deleteDeal(dealId: string) {
  const session = await verifySession();
  const deal = await db.deal.findFirst({ where: { id: dealId, companyId: session.companyId, ...(await dealScope()) }, select: { ownerId: true, customerId: true } });
  if (!deal) redirect(BOARD);
  if (deal.ownerId !== session.userId && !hasRole(session, ["OWNER", "ADMIN"])) redirect(`${BOARD}/${dealId}?error=forbidden`);
  await db.deal.delete({ where: { id: dealId, companyId: session.companyId } });
  await logAudit(session.companyId, session.userId, "deal.deleted", "Deal", dealId, {});
  await revalidateCrm(session.companyId, deal.customerId);
  redirect(BOARD);
}

// ---------- Products on a deal ----------

/** With products listed, the deal is worth their total. */
async function syncDealValue(dealId: string) {
  const items = await db.dealItem.findMany({ where: { dealId }, select: { quantity: true, unitPrice: true } });
  if (items.length > 0) await db.deal.update({ where: { id: dealId }, data: { value: quoteTotal(items) } });
}

export async function addDealItem(dealId: string, _state: QuoteItemFormState, formData: FormData): Promise<QuoteItemFormState> {
  const session = await verifySession();
  const parsed = QuoteItemSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    unitPrice: text(formData, "unitPrice"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const deal = await db.deal.findFirst({ where: { id: dealId, companyId: session.companyId, ...(await dealScope()) }, select: { id: true, customerId: true } });
  if (!deal) return { message: "Deal not found." };
  const product = await db.product.findFirst({ where: { id: parsed.data.productId, companyId: session.companyId }, select: { id: true, unitPrice: true } });
  if (!product) return { errors: { productId: ["Select a valid product."] } };

  await db.dealItem.create({
    data: { dealId, productId: product.id, quantity: parsed.data.quantity, unitPrice: parsed.data.unitPrice ?? product.unitPrice },
  });
  await syncDealValue(dealId);
  await revalidateCrm(session.companyId, deal.customerId, dealId);
  return undefined;
}

export async function removeDealItem(dealId: string, itemId: string) {
  const session = await verifySession();
  const deal = await db.deal.findFirst({ where: { id: dealId, companyId: session.companyId, ...(await dealScope()) }, select: { id: true, customerId: true } });
  if (!deal) return;
  await db.dealItem.deleteMany({ where: { id: itemId, dealId } });
  await syncDealValue(dealId);
  await revalidateCrm(session.companyId, deal.customerId, dealId);
}

// ---------- Activity history ----------

const ActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPE_IDS as [CrmActivityType, ...CrmActivityType[]]),
  body: z.string().trim().min(1).max(5000),
  occurredAt: z.string().optional(),
});

export async function logActivity(formData: FormData) {
  const session = await verifySession();
  const back = backTo(formData, "/dashboard/crm");
  const parsed = ActivitySchema.safeParse({
    type: formData.get("type") || "NOTE",
    body: formData.get("body"),
    occurredAt: text(formData, "occurredAt"),
  });
  if (!parsed.success) redirect(`${back}?error=activity-invalid`);

  const deal = await companyDeal(session.companyId, text(formData, "dealId"));
  const customer = await companyCustomer(session.companyId, deal?.customerId ?? text(formData, "customerId"));
  if (!customer) redirect(`${back}?error=invalid`);

  const occurredAt = dateOrNull(parsed.data.occurredAt);
  await db.crmActivity.create({
    data: {
      type: parsed.data.type,
      body: parsed.data.body,
      // A date in the future is treated as now: the history is what happened.
      occurredAt: occurredAt && occurredAt <= new Date() ? occurredAt : new Date(),
      companyId: session.companyId,
      customerId: customer.id,
      dealId: deal?.id ?? null,
      authorId: session.userId,
    },
  });
  await revalidateCrm(session.companyId, customer.id, deal?.id);
  redirect(back);
}

export async function deleteActivity(activityId: string) {
  const session = await verifySession();
  const activity = await db.crmActivity.findFirst({
    where: { id: activityId, companyId: session.companyId },
    select: { authorId: true, customerId: true, dealId: true },
  });
  if (!activity) return;
  if (activity.authorId !== session.userId && !hasRole(session, ["OWNER", "ADMIN"])) return;
  await db.crmActivity.delete({ where: { id: activityId } });
  await revalidateCrm(session.companyId, activity.customerId, activity.dealId ?? undefined);
}

// ---------- Follow-ups ----------

const FollowUpSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().min(1),
});

export async function createFollowUp(formData: FormData) {
  const session = await verifySession();
  const back = backTo(formData, "/dashboard/crm");
  const parsed = FollowUpSchema.safeParse({ title: formData.get("title"), dueAt: formData.get("dueAt") });
  const dueAt = parsed.success ? dateOrNull(parsed.data.dueAt) : null;
  if (!parsed.success || !dueAt) redirect(`${back}?error=followup-invalid`);

  const deal = await companyDeal(session.companyId, text(formData, "dealId"));
  const customer = await companyCustomer(session.companyId, deal?.customerId ?? text(formData, "customerId"));
  if (!customer) redirect(`${back}?error=invalid`);
  const assigneeId = text(formData, "assigneeId") ?? session.userId;
  if (!(await companyUser(session.companyId, assigneeId))) redirect(`${back}?error=invalid`);

  await db.followUp.create({
    data: {
      title: parsed.data.title,
      dueAt,
      companyId: session.companyId,
      customerId: customer.id,
      dealId: deal?.id ?? null,
      assigneeId,
      createdById: session.userId,
    },
  });
  await revalidateCrm(session.companyId, customer.id, deal?.id);
  revalidatePath("/dashboard/calendar");
  redirect(back);
}

/** Marks a follow-up done, or open again. */
export async function toggleFollowUp(followUpId: string) {
  const session = await verifySession();
  const followUp = await db.followUp.findFirst({
    where: { id: followUpId, companyId: session.companyId, ...(await followUpScope()) },
    select: { doneAt: true, customerId: true, dealId: true },
  });
  if (!followUp) return;
  await db.followUp.update({ where: { id: followUpId }, data: { doneAt: followUp.doneAt ? null : new Date() } });
  await revalidateCrm(session.companyId, followUp.customerId, followUp.dealId ?? undefined);
  revalidatePath("/dashboard/crm/reminders");
  revalidatePath("/dashboard/calendar");
}

export async function deleteFollowUp(followUpId: string) {
  const session = await verifySession();
  const followUp = await db.followUp.findFirst({
    where: { id: followUpId, companyId: session.companyId, ...(await followUpScope()) },
    select: { createdById: true, assigneeId: true, customerId: true, dealId: true },
  });
  if (!followUp) return;
  const mine = followUp.createdById === session.userId || followUp.assigneeId === session.userId;
  if (!mine && !hasRole(session, ["OWNER", "ADMIN"])) return;
  await db.followUp.delete({ where: { id: followUpId } });
  await revalidateCrm(session.companyId, followUp.customerId, followUp.dealId ?? undefined);
  revalidatePath("/dashboard/crm/reminders");
  revalidatePath("/dashboard/calendar");
}
