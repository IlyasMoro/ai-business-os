import { NextResponse } from "next/server";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const doc = await db.ediDocument.findUnique({
    where: { id, companyId: session.companyId },
    select: { docType: true, direction: true, controlNumber: true, content: true },
  });
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filename = `${doc.direction === "INBOUND" ? "in" : "out"}_${doc.docType}_${String(doc.controlNumber).padStart(9, "0")}.edi`;
  return new NextResponse(doc.content, {
    headers: {
      "Content-Type": "application/edi-x12; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
