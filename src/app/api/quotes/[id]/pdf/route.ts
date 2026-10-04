import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { QUOTE_STATUS_LABELS, displayStatus } from "@/lib/quotes";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();

  const quote = await db.quote.findFirst({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true, logoData: true, logoMimeType: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!quote) return new NextResponse("Not found", { status: 404 });

  const pdf = await generateInvoicePdf({
    kind: "Quote",
    invoiceNumber: quote.quoteNumber,
    status: QUOTE_STATUS_LABELS[displayStatus(quote)],
    issueDate: quote.sentAt ?? quote.createdAt,
    dueDate: quote.validUntil ?? quote.createdAt,
    taxRate: 0,
    totalAmount: quote.totalAmount,
    companyName: quote.companyRef.name,
    customerName: quote.customer.name,
    customerEmail: quote.customer.email,
    lineItems: quote.items.map((i) => ({ description: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice })),
    notes: quote.notes,
    logoData: quote.companyRef.logoData ? new Uint8Array(quote.companyRef.logoData) : undefined,
    logoMimeType: quote.companyRef.logoMimeType,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
