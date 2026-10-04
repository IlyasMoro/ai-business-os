import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import { purchaseOrderPdf } from "@/lib/document-pdfs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();

  // Same access as the page: locked employees only reach their own branch.
  const record = await db.purchaseOrder.findFirst({ where: { id, companyId: session.companyId, ...(await lockedWhere()) }, select: { id: true } });
  if (!record) return new NextResponse("Not found", { status: 404 });

  const pdf = await purchaseOrderPdf(session.companyId, id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
