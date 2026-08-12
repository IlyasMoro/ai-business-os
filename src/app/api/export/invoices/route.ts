import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const invoices = await db.invoice.findMany({
    where: { companyId: session.companyId },
    orderBy: { issueDate: "desc" },
    select: {
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      taxRate: true,
      totalAmount: true,
      customer: { select: { name: true, email: true } },
    },
  });

  const csv = toCsv(
    ["Invoice Number", "Status", "Issue Date", "Due Date", "Tax Rate", "Total Amount", "Customer", "Customer Email"],
    invoices.map((inv) => [
      inv.invoiceNumber,
      inv.status,
      inv.issueDate,
      inv.dueDate,
      inv.taxRate,
      inv.totalAmount,
      inv.customer.name,
      inv.customer.email,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
