import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const orders = await db.order.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: { status: true, totalAmount: true, createdAt: true, customer: { select: { name: true, email: true } } },
  });

  const csv = toCsv(
    ["Customer", "Customer Email", "Status", "Total Amount", "Created At"],
    orders.map((o) => [o.customer.name, o.customer.email, o.status, o.totalAmount, o.createdAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
