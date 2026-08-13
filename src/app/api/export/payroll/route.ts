import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const items = await db.payrollItem.findMany({
    where: { payrollRun: { companyId: session.companyId } },
    orderBy: { payrollRun: { periodStart: "desc" } },
    select: {
      grossPay: true,
      deductions: true,
      netPay: true,
      employee: { select: { name: true } },
      payrollRun: { select: { periodStart: true, periodEnd: true, status: true } },
    },
  });

  const csv = toCsv(
    ["Employee", "Period Start", "Period End", "Run Status", "Gross Pay", "Deductions", "Net Pay"],
    items.map((i) => [
      i.employee.name,
      i.payrollRun.periodStart,
      i.payrollRun.periodEnd,
      i.payrollRun.status,
      i.grossPay,
      i.deductions,
      i.netPay,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
