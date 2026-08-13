import "server-only";
import { rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import type { BusinessReportData, ReportSlice } from "@/lib/report-pdf";

const HEX = { blue: "#3b82f6", amber: "#d97706", emerald: "#059669", red: "#ef4444", muted: "#64748b" };

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const orderStatusOrder = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;
const orderStatusColor: Record<(typeof orderStatusOrder)[number], string> = {
  PENDING: HEX.amber,
  CONFIRMED: HEX.blue,
  FULFILLED: HEX.emerald,
  CANCELLED: HEX.red,
};

const invoiceStatusOrder = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;
const invoiceStatusColor: Record<(typeof invoiceStatusOrder)[number], string> = {
  DRAFT: HEX.muted,
  SENT: HEX.blue,
  PAID: HEX.emerald,
  OVERDUE: HEX.red,
};

/** Gathers the same 6-month snapshot the on-screen Reports page shows,
 * shaped for generateBusinessReportPdf. Shared by the on-demand download
 * route and the scheduled email so both paths can never drift apart. */
export async function getBusinessReportData(companyId: string, companyName: string): Promise<BusinessReportData> {
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [orderGroups, invoiceGroups, transactions, company] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.invoice.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.transaction.findMany({
      where: { companyId, date: { gte: sixMonthsAgo } },
      select: { type: true, amount: true, date: true },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { logoData: true, logoMimeType: true } }),
  ]);

  const orderCountByStatus = new Map(orderGroups.map((g) => [g.status, g._count._all]));
  const invoiceCountByStatus = new Map(invoiceGroups.map((g) => [g.status, g._count._all]));

  const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
  const monthly = months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const monthTx = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd);
    const income = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    return { label: format(monthStart, "MMM"), income, expense };
  });

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);

  const toSlices = <T extends string>(order: readonly T[], colors: Record<T, string>, counts: Map<string, number>): ReportSlice[] =>
    order.map((status) => ({
      label: status.charAt(0) + status.slice(1).toLowerCase(),
      value: counts.get(status) ?? 0,
      color: hexToRgb(colors[status]),
    }));

  return {
    companyName,
    generatedAt: new Date(),
    totalIncome,
    totalExpense,
    monthly,
    orderStatusSlices: toSlices(orderStatusOrder, orderStatusColor, orderCountByStatus),
    invoiceStatusSlices: toSlices(invoiceStatusOrder, invoiceStatusColor, invoiceCountByStatus),
    logoData: company?.logoData ? new Uint8Array(company.logoData) : undefined,
    logoMimeType: company?.logoMimeType,
  };
}
