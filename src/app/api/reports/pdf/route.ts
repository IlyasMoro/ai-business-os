import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBusinessReportData } from "@/lib/business-report-data";
import { generateBusinessReportPdf } from "@/lib/report-pdf";

export async function GET() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const company = await db.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  const data = await getBusinessReportData(session.companyId, company?.name ?? "Your company");
  const pdfBytes = await generateBusinessReportPdf(data);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="business-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
