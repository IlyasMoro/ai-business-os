import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Deliberately public (no session check): this image is embedded in
// customer-facing PDFs and emails, which are viewed by people who have never
// signed into AIBOS. companyId is an opaque, unguessable cuid, and a company
// logo isn't sensitive data.
export async function GET(_request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { logoData: true, logoMimeType: true },
  });

  if (!company?.logoData || !company.logoMimeType) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(company.logoData), {
    headers: {
      "Content-Type": company.logoMimeType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
