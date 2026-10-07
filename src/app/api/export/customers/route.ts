import { NextResponse } from "next/server";
import { requireModuleApi } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { sourceLabel } from "@/lib/crm-pipeline";
import { customerScope } from "@/lib/crm-access";
import { asCustomValues } from "@/lib/custom-fields";

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
  const session = await requireModuleApi("crm");
  if (session instanceof Response) return session;

  // ?template=1: the headings and one example row, for the import page.
  if (new URL(request.url).searchParams.get("template")) {
    return csvResponse(
      toCsv(HEADERS, [["Acme Trading", "orders@acme.example", "+27 21 555 0100", "Acme Trading (Pty) Ltd", "Lead", "Referral", "Met at the trade show", 5000, ""]]),
      "customer_import_template.csv"
    );
  }

  const [customers, fields] = await Promise.all([
    db.customer.findMany({
    where: { companyId: session.companyId, ...(await customerScope()) },
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
      leadScore: true,
      customFields: true,
      tags: { select: { name: true }, orderBy: { name: "asc" } },
    },
  }),
    db.customField.findMany({ where: { companyId: session.companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);

  // Extra columns after the importable ones; the import skips them.
  const csv = toCsv(
    [...HEADERS, "Created At", "Tags", "Lead score", ...fields.map((f) => f.label)],
    customers.map((c) => {
      const values = asCustomValues(c.customFields);
      return [
        c.name,
        c.email,
        c.phone,
        c.company,
        c.status,
        sourceLabel(c.source),
        c.notes,
        c.creditLimit,
        c.owner?.email,
        c.createdAt,
        c.tags.map((t) => t.name).join("; "),
        c.leadScore,
        ...fields.map((f) => values[f.id] ?? ""),
      ];
    })
  );
  return csvResponse(csv, "customers.csv");
}
