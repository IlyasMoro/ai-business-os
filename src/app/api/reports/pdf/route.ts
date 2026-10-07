import { NextResponse } from "next/server";
import { requireModuleApi } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBusinessReportData } from "@/lib/business-report-data";
import { getBranchContext } from "@/lib/branches";
import { generateBusinessReportPdf } from "@/lib/report-pdf";

export async function GET() {
  const session = await requireModuleApi("reports");
  if (session instanceof Response) return session;

  const company = await db.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  // Matches the Reports page: one branch when the switcher has one picked.
  const { viewBranch } = await getBranchContext();
  const data = await getBusinessReportData(
    session.companyId,
    company?.name ?? "Your company",
    viewBranch ? { id: viewBranch.id, name: viewBranch.name } : null
  );
  const pdfBytes = await generateBusinessReportPdf(data);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="business-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
