import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const purchaseOrders = await db.purchaseOrder.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      totalAmount: true,
      createdAt: true,
      expectedDate: true,
      receivedAt: true,
      supplier: { select: { name: true } },
    },
  });

  const csv = toCsv(
    ["Supplier", "Status", "Total Amount", "Created At", "Expected Date", "Received At"],
    purchaseOrders.map((p) => [p.supplier.name, p.status, p.totalAmount, p.createdAt, p.expectedDate, p.receivedAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
