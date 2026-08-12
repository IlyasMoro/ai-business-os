import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const transactions = await db.transaction.findMany({
    where: { companyId: session.companyId },
    orderBy: { date: "desc" },
    select: { date: true, type: true, category: true, amount: true, description: true },
  });

  const csv = toCsv(
    ["Date", "Type", "Category", "Amount", "Description"],
    transactions.map((t) => [t.date, t.type, t.category, t.amount, t.description])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
