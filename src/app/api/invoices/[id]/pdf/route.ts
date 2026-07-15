import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();

  const invoice = await db.invoice.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true } },
      lineItems: { select: { description: true, quantity: true, unitPrice: true } },
    },
  });

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    companyName: invoice.companyRef.name,
    customerName: invoice.customer.name,
    customerEmail: invoice.customer.email,
    lineItems: invoice.lineItems,
  });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
