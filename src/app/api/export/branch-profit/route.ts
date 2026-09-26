import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { toCsv } from "@/lib/csv";
import { getProfitByBranch } from "@/lib/branch-profit-data";
import { PROFIT_CSV_HEADERS, profitCsvRows } from "@/lib/branch-profit";

export async function GET() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { rows, total } = await getProfitByBranch(session.companyId);
  const csv = toCsv(PROFIT_CSV_HEADERS, profitCsvRows(rows, total));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="profit_by_branch.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
