import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const projects = await db.project.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: { name: true, status: true, dueDate: true, createdAt: true, customer: { select: { name: true } } },
  });

  const csv = toCsv(
    ["Name", "Customer", "Status", "Due Date", "Created At"],
    projects.map((p) => [p.name, p.customer?.name, p.status, p.dueDate, p.createdAt])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
