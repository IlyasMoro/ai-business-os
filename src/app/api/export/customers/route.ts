import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { sourceLabel } from "@/lib/crm-pipeline";

// The same headings the import reads, so an export can be imported again.
const HEADERS = ["Name", "Email", "Phone", "Company", "Status", "Lead source", "Notes", "Credit limit", "Owner email"];

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const session = await verifySession();

  // ?template=1: the headings and one example row, for the import page.
  if (new URL(request.url).searchParams.get("template")) {
    return csvResponse(
      toCsv(HEADERS, [["Acme Trading", "orders@acme.example", "+27 21 555 0100", "Acme Trading (Pty) Ltd", "Lead", "Referral", "Met at the trade show", 5000, ""]]),
      "customer_import_template.csv"
    );
  }

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      company: true,
      status: true,
      source: true,
      notes: true,
      creditLimit: true,
      owner: { select: { email: true } },
      createdAt: true,
    },
  });

  const csv = toCsv(
    [...HEADERS, "Created At"],
    customers.map((c) => [c.name, c.email, c.phone, c.company, c.status, sourceLabel(c.source), c.notes, c.creditLimit, c.owner?.email, c.createdAt])
  );
  return csvResponse(csv, "customers.csv");
}
