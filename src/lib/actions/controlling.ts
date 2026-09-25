"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getControllingSettings, internalOrderActual, loadCostLines } from "@/lib/controlling";
import { CONTROLLING_PRESETS, isControllingPreset } from "@/lib/controlling-presets";
import {
  allocate,
  fiscalYearMonths,
  formatInternalOrderNumber,
  monthLabel,
  periodKey,
  periodRange,
  validateShares,
} from "@/lib/controlling-math";
import {
  AllocationSchema,
  ControllingSettingsSchema,
  CostCenterSchema,
  CostCenterUpdateSchema,
  InternalOrderSchema,
  MoneySchema,
  PeriodSchema,
} from "@/lib/validation/controlling";

const BASE = "/dashboard/controlling";

async function requireAdmin(back: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  return session;
}

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v : undefined;
};

async function ownCostCenter(companyId: string, id: string | undefined, back: string) {
  if (!id) return null;
  const cc = await db.costCenter.findUnique({ where: { id, companyId }, select: { id: true } });
  if (!cc) redirect(`${back}?error=invalid`);
  return cc.id;
}

// ---------- Cost centers & planning ----------

export async function createCostCenter(formData: FormData) {
  const back = `${BASE}/cost-centers`;
  const session = await requireAdmin(back);
  const validated = CostCenterSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: text(formData, "description"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const exists = await db.costCenter.findUnique({
    where: { companyId_code: { companyId: session.companyId, code: validated.data.code } },
    select: { id: true },
  });
  if (exists) redirect(`${back}?error=co-duplicate`);

  const cc = await db.costCenter.create({ data: { ...validated.data, companyId: session.companyId } });
  await logAudit(session.companyId, session.userId, "cost_center.created", "CostCenter", cc.id, { code: cc.code });
  revalidatePath(BASE, "layout");
  redirect(`${back}/${cc.id}`);
}

export async function updateCostCenter(costCenterId: string, formData: FormData) {
  const back = `${BASE}/cost-centers/${costCenterId}`;
  const session = await requireAdmin(back);
  const validated = CostCenterUpdateSchema.safeParse({
    name: formData.get("name"),
    description: text(formData, "description"),
    active: formData.get("active") === "on",
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  await db.costCenter.update({
    where: { id: costCenterId, companyId: session.companyId },
    data: { ...validated.data, description: validated.data.description ?? null },
  });
  revalidatePath(BASE, "layout");
  redirect(`${back}?saved=1`);
}

export async function deleteCostCenter(costCenterId: string) {
  const back = `${BASE}/cost-centers/${costCenterId}`;
  const session = await requireAdmin(back);
  const cc = await db.costCenter.findUnique({
    where: { id: costCenterId, companyId: session.companyId },
    select: { _count: { select: { transactions: true, employees: true, postings: true } } },
  });
  if (!cc) redirect(`${BASE}/cost-centers`);
  // Anything that has carried cost stays for the history; deactivate it instead.
  if (cc._count.transactions + cc._count.employees + cc._count.postings > 0) redirect(`${back}?error=co-in-use`);

  await db.costCenter.delete({ where: { id: costCenterId, companyId: session.companyId } });
  revalidatePath(BASE, "layout");
  redirect(`${BASE}/cost-centers`);
}

/** Saves one fiscal year of monthly plan values for a cost center. */
export async function saveBudgets(costCenterId: string, fiscalYear: number, formData: FormData) {
  const back = `${BASE}/cost-centers/${costCenterId}`;
  const session = await requireAdmin(back);
  const cc = await db.costCenter.findUnique({ where: { id: costCenterId, companyId: session.companyId }, select: { id: true } });
  if (!cc) redirect(`${BASE}/cost-centers`);

  const settings = await getControllingSettings(session.companyId);
  const months = fiscalYearMonths(fiscalYear, settings.fiscalYearStartMonth);
  const fill = text(formData, "fillAll");

  const values: { year: number; month: number; amount: number }[] = [];
  for (const p of months) {
    const raw = fill ?? formData.get(`m${periodKey(p)}`) ?? "";
    const parsed = MoneySchema.safeParse(raw === "" ? 0 : raw);
    if (!parsed.success) redirect(`${back}?fy=${fiscalYear}&error=invalid`);
    values.push({ ...p, amount: parsed.data });
  }

  await db.$transaction(
    values.map((v) =>
      v.amount > 0
        ? db.costBudget.upsert({
            where: { costCenterId_year_month: { costCenterId: cc.id, year: v.year, month: v.month } },
            create: { costCenterId: cc.id, ...v },
            update: { amount: v.amount },
          })
        : db.costBudget.deleteMany({ where: { costCenterId: cc.id, year: v.year, month: v.month } })
    )
  );
  await logAudit(session.companyId, session.userId, "cost_center.budget_saved", "CostCenter", cc.id, { fiscalYear });

  revalidatePath(BASE, "layout");
  redirect(`${back}?fy=${fiscalYear}&saved=1`);
}

// ---------- Internal orders ----------

export async function createInternalOrder(formData: FormData) {
  const back = `${BASE}/orders`;
  const session = await requireAdmin(back);
  const validated = InternalOrderSchema.safeParse({
    name: formData.get("name"),
    description: text(formData, "description"),
    budget: formData.get("budget") || 0,
    settleToId: text(formData, "settleToId"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const settleToId = await ownCostCenter(session.companyId, validated.data.settleToId, back);
  const count = await db.internalOrder.count({ where: { companyId: session.companyId } });
  const io = await db.internalOrder.create({
    data: {
      orderNumber: formatInternalOrderNumber(count + 1),
      name: validated.data.name,
      description: validated.data.description,
      budget: validated.data.budget,
      settleToId,
      companyId: session.companyId,
    },
  });
  await logAudit(session.companyId, session.userId, "internal_order.created", "InternalOrder", io.id, { orderNumber: io.orderNumber });
  revalidatePath(BASE, "layout");
  redirect(`${back}/${io.id}`);
}

export async function updateInternalOrder(orderId: string, formData: FormData) {
  const back = `${BASE}/orders/${orderId}`;
  const session = await requireAdmin(back);
  const validated = InternalOrderSchema.safeParse({
    name: formData.get("name"),
    description: text(formData, "description"),
    budget: formData.get("budget") || 0,
    settleToId: text(formData, "settleToId"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const io = await db.internalOrder.findUnique({ where: { id: orderId, companyId: session.companyId }, select: { status: true } });
  if (!io) redirect(`${BASE}/orders`);
  if (io.status === "SETTLED") redirect(`${back}?error=co-settled`);

  const settleToId = await ownCostCenter(session.companyId, validated.data.settleToId, back);
  await db.internalOrder.update({
    where: { id: orderId },
    data: { name: validated.data.name, description: validated.data.description ?? null, budget: validated.data.budget, settleToId },
  });
  revalidatePath(BASE, "layout");
  redirect(`${back}?saved=1`);
}

/** Closing stops new costs landing on the order; settling still to come. */
export async function closeInternalOrder(orderId: string) {
  const back = `${BASE}/orders/${orderId}`;
  const session = await requireAdmin(back);
  await db.internalOrder.update({
    where: { id: orderId, companyId: session.companyId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  revalidatePath(BASE, "layout");
  redirect(back);
}

export async function reopenInternalOrder(orderId: string) {
  const back = `${BASE}/orders/${orderId}`;
  const session = await requireAdmin(back);
  await db.internalOrder.update({
    where: { id: orderId, companyId: session.companyId, status: "CLOSED" },
    data: { status: "OPEN", closedAt: null },
  });
  revalidatePath(BASE, "layout");
  redirect(back);
}

/**
 * Settlement: moves the order's whole balance onto its receiving cost
 * center with a pair of postings, leaving the order at zero.
 */
export async function settleInternalOrder(orderId: string) {
  const back = `${BASE}/orders/${orderId}`;
  const session = await requireAdmin(back);
  const io = await db.internalOrder.findUnique({
    where: { id: orderId, companyId: session.companyId },
    select: { id: true, orderNumber: true, name: true, status: true, settleToId: true },
  });
  if (!io) redirect(`${BASE}/orders`);
  if (io.status === "SETTLED") redirect(`${back}?error=co-settled`);
  if (!io.settleToId) redirect(`${back}?error=co-no-receiver`);

  const settings = await getControllingSettings(session.companyId);
  const balance = Math.round((await internalOrderActual(session.companyId, io.id, settings)) * 100) / 100;
  const now = new Date();
  const reference = `Settlement of ${io.orderNumber} ${io.name}`;

  await db.$transaction([
    ...(balance !== 0
      ? [
          db.coPosting.create({ data: { kind: "SETTLEMENT", date: now, amount: -balance, reference, internalOrderId: io.id, companyId: session.companyId } }),
          db.coPosting.create({ data: { kind: "SETTLEMENT", date: now, amount: balance, reference, costCenterId: io.settleToId, companyId: session.companyId } }),
        ]
      : []),
    db.internalOrder.update({ where: { id: io.id }, data: { status: "SETTLED", settledAt: now, closedAt: now } }),
  ]);
  await logAudit(session.companyId, session.userId, "internal_order.settled", "InternalOrder", io.id, { amount: balance });

  revalidatePath(BASE, "layout");
  redirect(`${back}?saved=1`);
}

// ---------- Allocation ----------

export async function createAllocation(formData: FormData) {
  const back = `${BASE}/allocations`;
  const session = await requireAdmin(back);

  const receivers: { costCenterId: string; percent: FormDataEntryValue | null }[] = [];
  for (let i = 0; i < 8; i++) {
    const id = text(formData, `receiver${i}`);
    if (id) receivers.push({ costCenterId: id, percent: formData.get(`percent${i}`) });
  }
  const validated = AllocationSchema.safeParse({ name: formData.get("name"), senderId: formData.get("senderId"), receivers });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const { name, senderId } = validated.data;
  const rows = validated.data.receivers;
  const shareError = validateShares(rows.map((r) => r.percent));
  if (shareError) redirect(`${back}?error=co-shares`);
  const ids = rows.map((r) => r.costCenterId);
  if (ids.includes(senderId) || new Set(ids).size !== ids.length) redirect(`${back}?error=co-shares`);

  const owned = await db.costCenter.count({ where: { companyId: session.companyId, id: { in: [senderId, ...ids] } } });
  if (owned !== ids.length + 1) redirect(`${back}?error=invalid`);

  await db.coAllocation.create({
    data: {
      name,
      senderId,
      companyId: session.companyId,
      receivers: { create: rows.map((r) => ({ costCenterId: r.costCenterId, percent: r.percent })) },
    },
  });
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function deleteAllocation(allocationId: string) {
  const back = `${BASE}/allocations`;
  const session = await requireAdmin(back);
  await db.coAllocation.delete({ where: { id: allocationId, companyId: session.companyId } });
  revalidatePath(BASE, "layout");
}

/**
 * Runs one allocation cycle for one month: takes the sender's actual cost
 * for that month and moves it to the receivers by their shares. A cycle
 * runs once per month; reverse it to run again.
 */
export async function runAllocation(allocationId: string, formData: FormData) {
  const back = `${BASE}/allocations`;
  const session = await requireAdmin(back);
  const period = PeriodSchema.safeParse(formData.get("period"));
  if (!period.success) redirect(`${back}?error=invalid`);
  const [year, month] = period.data.split("-").map(Number);

  const allocation = await db.coAllocation.findUnique({
    where: { id: allocationId, companyId: session.companyId },
    include: { sender: { select: { id: true, code: true } }, receivers: true },
  });
  if (!allocation) redirect(back);

  const already = await db.coAllocationRun.findUnique({
    where: { allocationId_year_month: { allocationId, year, month } },
    select: { id: true },
  });
  if (already) redirect(`${back}?error=co-already-run`);

  const settings = await getControllingSettings(session.companyId);
  const range = periodRange([{ year, month }]);
  const lines = await loadCostLines(session.companyId, range, settings, { costCenterId: allocation.senderId });
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  if (total <= 0) redirect(`${back}?error=co-nothing`);

  const shares = allocate(
    total,
    allocation.receivers.map((r) => ({ id: r.costCenterId, percent: r.percent }))
  );
  const date = new Date(Date.UTC(year, month, 0, 12)); // last day of the month
  const reference = `Allocation ${allocation.name}, ${monthLabel({ year, month })}`;

  await db.coAllocationRun.create({
    data: {
      allocationId,
      year,
      month,
      amount: total,
      postings: {
        create: [
          { kind: "ALLOCATION", date, amount: -total, reference, costCenterId: allocation.senderId, companyId: session.companyId },
          ...shares.map((s) => ({ kind: "ALLOCATION" as const, date, amount: s.amount, reference, costCenterId: s.id, companyId: session.companyId })),
        ],
      },
    },
  });
  await logAudit(session.companyId, session.userId, "allocation.run", "CoAllocation", allocationId, { period: period.data, total });

  revalidatePath(BASE, "layout");
  redirect(`${back}?saved=1`);
}

export async function reverseAllocationRun(runId: string) {
  const back = `${BASE}/allocations`;
  const session = await requireAdmin(back);
  await db.coAllocationRun.delete({ where: { id: runId, allocation: { companyId: session.companyId } } });
  await logAudit(session.companyId, session.userId, "allocation.reversed", "CoAllocationRun", runId);
  revalidatePath(BASE, "layout");
}

// ---------- Settings ----------

export async function updateControllingSettings(formData: FormData) {
  const back = `${BASE}/settings`;
  const session = await requireAdmin(back);
  const validated = ControllingSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    fiscalYearStartMonth: formData.get("fiscalYearStartMonth"),
    overBudgetAction: formData.get("overBudgetAction"),
    tolerancePercent: formData.get("tolerancePercent"),
    includePayroll: formData.get("includePayroll") === "on",
    requireCostCenter: formData.get("requireCostCenter") === "on",
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  await db.controllingSettings.upsert({
    where: { companyId: session.companyId },
    create: { ...validated.data, companyId: session.companyId },
    update: validated.data,
  });
  await logAudit(session.companyId, session.userId, "controlling_settings.updated", "ControllingSettings", session.companyId);
  revalidatePath("/dashboard", "layout");
  redirect(`${back}?saved=1`);
}

export async function applyControllingPreset(preset: string) {
  const back = `${BASE}/settings`;
  const session = await requireAdmin(back);
  if (!isControllingPreset(preset)) redirect(`${back}?error=invalid`);

  const values = CONTROLLING_PRESETS[preset].values;
  await db.controllingSettings.upsert({
    where: { companyId: session.companyId },
    create: { ...values, companyId: session.companyId },
    update: values,
  });
  await logAudit(session.companyId, session.userId, "controlling_settings.preset_applied", "ControllingSettings", session.companyId, { preset });
  revalidatePath("/dashboard", "layout");
  redirect(`${back}?saved=1`);
}
