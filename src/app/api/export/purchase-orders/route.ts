import { NextResponse } from "next/server";
import { requireModuleApi } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await requireModuleApi("procurement");
  if (session instanceof Response) return session;

  const purchaseOrders = await db.purchaseOrder.findMany({
    where: { companyId: session.companyId, ...(await branchWhere()) },
    orderBy: { createdAt: "desc" },
    select: {
      poNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      expectedDate: true,
      receivedAt: true,
      supplier: { select: { name: true } },
    },
  });

  const csv = toCsv(
    ["PO Number", "Supplier", "Status", "Total Amount", "Created At", "Expected Date", "Received At"],
    purchaseOrders.map((p) => [p.poNumber, p.supplier.name, p.status, p.totalAmount, p.createdAt, p.expectedDate, p.receivedAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-orders.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
