import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { generatePayslipPdf } from "@/lib/payslip-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();

  const item = await db.payrollItem.findUnique({
    where: { id, payrollRun: { companyId: session.companyId } },
    include: {
      employee: { select: { name: true, position: true } },
      payrollRun: { select: { periodStart: true, periodEnd: true, companyRef: { select: { name: true } } } },
    },
  });

  if (!item) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdfBytes = await generatePayslipPdf({
    companyName: item.payrollRun.companyRef.name,
    employeeName: item.employee.name,
    position: item.employee.position,
    periodStart: item.payrollRun.periodStart,
    periodEnd: item.payrollRun.periodEnd,
    grossPay: item.grossPay,
    deductions: item.deductions,
    netPay: item.netPay,
  });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payslip-${item.employee.name.replace(/\s+/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
