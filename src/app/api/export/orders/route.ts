import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const orders = await db.order.findMany({
    where: { companyId: session.companyId, ...(await branchWhere()) },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true, status: true, totalAmount: true, createdAt: true, customer: { select: { name: true, email: true } }, invoice: { select: { invoiceNumber: true } } },
  });

  const csv = toCsv(
    ["Order Number", "Customer", "Customer Email", "Status", "Total Amount", "Invoice", "Created At"],
    orders.map((o) => [o.orderNumber, o.customer.name, o.customer.email, o.status, o.totalAmount, o.invoice?.invoiceNumber, o.createdAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
