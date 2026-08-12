import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: { name: true, email: true, phone: true, company: true, status: true, createdAt: true },
  });

  const csv = toCsv(
    ["Name", "Email", "Phone", "Company", "Status", "Created At"],
    customers.map((c) => [c.name, c.email, c.phone, c.company, c.status, c.createdAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
