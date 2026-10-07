import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { contentDisposition } from "@/lib/document-files";
import { canOpenModule, type ModuleKey } from "@/lib/role-access";
import type { DocumentEntityType } from "@/generated/prisma/client";

const DOCUMENT_MODULE: Record<DocumentEntityType, ModuleKey> = {
  CUSTOMER: "crm",
  INVOICE: "invoicing",
  TICKET: "support",
  PROJECT: "projects",
  CAMPAIGN: "marketing",
  EMPLOYEE: "hr",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();

  const doc = await db.document.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  // A file is only as open as the record it is attached to.
  if (!canOpenModule(session, DOCUMENT_MODULE[doc.entityType])) {
    return new NextResponse("You don't have access to this.", { status: 403 });
  }

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mimeType,
      // Only PDFs, images and plain text open in the tab; anything else (an
      // uploaded HTML or SVG file, say) downloads, so it can't run as a page
      // inside the app. nosniff stops the browser guessing otherwise.
      "Content-Disposition": contentDisposition(doc.mimeType, doc.filename),
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(doc.size),
      "Cache-Control": "private, no-store",
    },
  });
}
