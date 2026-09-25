import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_CONTROLLING, type ControllingValues } from "@/lib/controlling-presets";
import { checkAvailability, periodOf, periodRange, type AvailabilityResult } from "@/lib/controlling-math";

export const getControllingSettings = cache(async (companyId: string): Promise<ControllingValues> => {
  const s = await db.controllingSettings.findUnique({
    where: { companyId },
    select: {
      enabled: true,
      fiscalYearStartMonth: true,
      overBudgetAction: true,
      tolerancePercent: true,
      includePayroll: true,
      requireCostCenter: true,
    },
  });
  return s ?? DEFAULT_CONTROLLING;
});

export type CostLine = {
  date: Date;
  amount: number;
  source: "EXPENSE" | "PAYROLL" | "ALLOCATION" | "SETTLEMENT";
  label: string;
  href: string | null;
  costCenterId: string | null;
  internalOrderId: string | null;
};

/**
 * Every cost that lands on a cost center or internal order in [from, to):
 *  - expenses from Accounting (an expense on an internal order counts on
 *    the order, not a cost center, until the order is settled),
 *  - paid payroll, on each employee's cost center, if the company counts it,
 *  - allocation and settlement postings made inside Controlling.
 */
export async function loadCostLines(
  companyId: string,
  range: { from: Date; to: Date },
  settings: ControllingValues,
  only?: { costCenterId?: string; internalOrderId?: string }
): Promise<CostLine[]> {
  const dateFilter = { gte: range.from, lt: range.to };
  const objectFilter = only?.costCenterId
    ? { costCenterId: only.costCenterId }
    : only?.internalOrderId
      ? { internalOrderId: only.internalOrderId }
      : { OR: [{ costCenterId: { not: null } }, { internalOrderId: { not: null } }] };

  const [expenses, postings, payroll] = await Promise.all([
    db.transaction.findMany({
      where: { companyId, type: "EXPENSE", date: dateFilter, ...objectFilter },
      select: { id: true, date: true, amount: true, category: true, description: true, costCenterId: true, internalOrderId: true },
    }),
    db.coPosting.findMany({
      where: { companyId, date: dateFilter, ...objectFilter },
      select: { date: true, amount: true, kind: true, reference: true, costCenterId: true, internalOrderId: true },
    }),
    settings.includePayroll && !only?.internalOrderId
      ? db.payrollItem.findMany({
          where: {
            payrollRun: { companyId, status: "PAID", periodEnd: dateFilter },
            employee: only?.costCenterId ? { costCenterId: only.costCenterId } : { costCenterId: { not: null } },
          },
          select: {
            grossPay: true,
            payrollRun: { select: { id: true, periodEnd: true } },
            employee: { select: { name: true, costCenterId: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...expenses.map((t) => ({
      date: t.date,
      amount: t.amount,
      source: "EXPENSE" as const,
      label: t.description ? `${t.category}: ${t.description}` : t.category,
      href: `/dashboard/accounting/${t.id}`,
      costCenterId: t.internalOrderId ? null : t.costCenterId,
      internalOrderId: t.internalOrderId,
    })),
    ...postings.map((p) => ({
      date: p.date,
      amount: p.amount,
      source: p.kind,
      label: p.reference,
      href: null,
      costCenterId: p.costCenterId,
      internalOrderId: p.internalOrderId,
    })),
    ...payroll.map((i) => ({
      date: i.payrollRun.periodEnd,
      amount: i.grossPay,
      source: "PAYROLL" as const,
      label: `Payroll: ${i.employee.name}`,
      href: `/dashboard/payroll/${i.payrollRun.id}`,
      costCenterId: i.employee.costCenterId,
      internalOrderId: null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function sumBy(lines: CostLine[], key: "costCenterId" | "internalOrderId"): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const id = line[key];
    if (id) totals.set(id, (totals.get(id) ?? 0) + line.amount);
  }
  return totals;
}

/** All time actual cost on an internal order, net of any settlement. */
export async function internalOrderActual(companyId: string, internalOrderId: string, settings: ControllingValues) {
  const lines = await loadCostLines(
    companyId,
    { from: new Date(Date.UTC(1970, 0, 1)), to: new Date(Date.UTC(9999, 0, 1)) },
    settings,
    { internalOrderId }
  );
  return lines.reduce((s, l) => s + l.amount, 0);
}

export type CostObjectCheck =
  | { ok: false; message: string }
  | { ok: true; costCenterId: string | null; internalOrderId: string | null; availability: AvailabilityResult | null; objectLabel: string | null };

/**
 * Validates the cost object chosen for an expense ("cc:<id>" or "io:<id>")
 * and runs availability control against its budget. `excludeTransactionId`
 * leaves out the expense being edited so it isn't counted twice.
 */
export async function checkCostObject(opts: {
  companyId: string;
  settings: ControllingValues;
  type: "INCOME" | "EXPENSE";
  costObject: string | undefined;
  amount: number;
  date: Date;
  excludeTransactionId?: string;
}): Promise<CostObjectCheck> {
  const { companyId, settings } = opts;
  if (!settings.enabled || !opts.costObject) {
    if (settings.enabled && settings.requireCostCenter && opts.type === "EXPENSE") {
      return { ok: false, message: "Choose a cost center or internal order for this expense." };
    }
    return { ok: true, costCenterId: null, internalOrderId: null, availability: null, objectLabel: null };
  }

  const [kind, id] = opts.costObject.split(":");
  const excluded = opts.excludeTransactionId
    ? await db.transaction.findUnique({ where: { id: opts.excludeTransactionId }, select: { amount: true, type: true, costCenterId: true, internalOrderId: true, date: true } })
    : null;

  if (kind === "cc") {
    const cc = await db.costCenter.findUnique({ where: { id, companyId }, select: { id: true, code: true, name: true, active: true } });
    if (!cc || !cc.active) return { ok: false, message: "Select an active cost center." };
    if (opts.type !== "EXPENSE") return { ok: true, costCenterId: cc.id, internalOrderId: null, availability: null, objectLabel: null };

    const p = periodOf(opts.date);
    const [budget, lines] = await Promise.all([
      db.costBudget.findUnique({ where: { costCenterId_year_month: { costCenterId: cc.id, year: p.year, month: p.month } }, select: { amount: true } }),
      loadCostLines(companyId, periodRange([p]), settings, { costCenterId: cc.id }),
    ]);
    let consumed = lines.filter((l) => l.costCenterId === cc.id).reduce((s, l) => s + l.amount, 0);
    if (excluded && excluded.type === "EXPENSE" && excluded.costCenterId === cc.id && !excluded.internalOrderId && periodOf(excluded.date).month === p.month && periodOf(excluded.date).year === p.year) {
      consumed -= excluded.amount;
    }
    const availability = checkAvailability({
      budget: budget?.amount ?? 0,
      consumed,
      amount: opts.amount,
      tolerancePercent: settings.tolerancePercent,
      action: settings.overBudgetAction,
    });
    return { ok: true, costCenterId: cc.id, internalOrderId: null, availability, objectLabel: `cost center ${cc.code} ${cc.name}` };
  }

  if (kind === "io") {
    const io = await db.internalOrder.findUnique({ where: { id, companyId }, select: { id: true, orderNumber: true, name: true, status: true, budget: true } });
    if (!io) return { ok: false, message: "Select a valid internal order." };
    if (io.status !== "OPEN") return { ok: false, message: `${io.orderNumber} is ${io.status.toLowerCase()} and can't take new costs.` };
    if (opts.type !== "EXPENSE") return { ok: true, costCenterId: null, internalOrderId: io.id, availability: null, objectLabel: null };

    let consumed = await internalOrderActual(companyId, io.id, settings);
    if (excluded && excluded.type === "EXPENSE" && excluded.internalOrderId === io.id) consumed -= excluded.amount;
    const availability = checkAvailability({
      budget: io.budget,
      consumed,
      amount: opts.amount,
      tolerancePercent: settings.tolerancePercent,
      action: settings.overBudgetAction,
    });
    return { ok: true, costCenterId: null, internalOrderId: io.id, availability, objectLabel: `internal order ${io.orderNumber} ${io.name}` };
  }

  return { ok: false, message: "Select a valid cost center or internal order." };
}

export type CostObjectOptions = {
  centers: { value: string; label: string }[];
  orders: { value: string; label: string }[];
} | null;

/** Choices for the cost object picker; null when Controlling is off. */
export async function loadCostObjectOptions(
  companyId: string,
  keep?: { costCenterId?: string | null; internalOrderId?: string | null }
): Promise<CostObjectOptions> {
  const settings = await getControllingSettings(companyId);
  if (!settings.enabled) return null;
  const [centers, orders] = await Promise.all([
    db.costCenter.findMany({
      // Keep an inactive center listed if the record being edited uses it.
      where: { companyId, OR: [{ active: true }, ...(keep?.costCenterId ? [{ id: keep.costCenterId }] : [])] },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    db.internalOrder.findMany({
      where: { companyId, OR: [{ status: "OPEN" as const }, ...(keep?.internalOrderId ? [{ id: keep.internalOrderId }] : [])] },
      select: { id: true, orderNumber: true, name: true },
      orderBy: { orderNumber: "asc" },
    }),
  ]);
  return {
    centers: centers.map((c) => ({ value: `cc:${c.id}`, label: `${c.code} ${c.name}` })),
    orders: orders.map((o) => ({ value: `io:${o.id}`, label: `${o.orderNumber} ${o.name}` })),
  };
}

export function costObjectValue(t: { costCenterId: string | null; internalOrderId: string | null }): string {
  return t.internalOrderId ? `io:${t.internalOrderId}` : t.costCenterId ? `cc:${t.costCenterId}` : "";
}

export type PlanActualRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  plan: number;
  actual: number;
};

/** Plan and actual per cost center over the given months. */
export async function costCenterPlanActual(
  companyId: string,
  settings: ControllingValues,
  periods: { year: number; month: number }[]
): Promise<{ rows: PlanActualRow[]; lines: CostLine[]; budgets: { costCenterId: string; year: number; month: number; amount: number }[] }> {
  const range = periodRange(periods);
  const [centers, lines, budgets] = await Promise.all([
    db.costCenter.findMany({ where: { companyId }, select: { id: true, code: true, name: true, active: true }, orderBy: { code: "asc" } }),
    loadCostLines(companyId, range, settings),
    db.costBudget.findMany({
      where: {
        costCenter: { companyId },
        OR: periods.map((p) => ({ year: p.year, month: p.month })),
      },
      select: { costCenterId: true, year: true, month: true, amount: true },
    }),
  ]);
  const actual = sumBy(lines, "costCenterId");
  const plan = new Map<string, number>();
  for (const b of budgets) plan.set(b.costCenterId, (plan.get(b.costCenterId) ?? 0) + b.amount);
  return {
    rows: centers.map((c) => ({ ...c, plan: plan.get(c.id) ?? 0, actual: actual.get(c.id) ?? 0 })),
    lines,
    budgets,
  };
}
