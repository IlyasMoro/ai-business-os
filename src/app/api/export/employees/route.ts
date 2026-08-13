import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const employees = await db.employee.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: "asc" },
    select: { name: true, email: true, position: true, department: true, salary: true, hireDate: true, status: true },
  });

  const csv = toCsv(
    ["Name", "Email", "Position", "Department", "Salary", "Hire Date", "Status"],
    employees.map((e) => [e.name, e.email, e.position, e.department, e.salary, e.hireDate, e.status])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
