import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const tickets = await db.ticket.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      subject: true,
      status: true,
      priority: true,
      createdAt: true,
      customer: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  const csv = toCsv(
    ["Subject", "Customer", "Status", "Priority", "Assignee", "Created At"],
    tickets.map((t) => [t.subject, t.customer.name, t.status, t.priority, t.assignee?.name, t.createdAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tickets.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
