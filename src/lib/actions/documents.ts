"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import type { DocumentEntityType } from "@/generated/prisma/client";
import { uploadBlocker } from "@/lib/document-files";


async function verifyEntityOwnership(
  entityType: DocumentEntityType,
  entityId: string,
  companyId: string
) {
  switch (entityType) {
    case "CUSTOMER":
      return !!(await db.customer.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
    case "INVOICE":
      return !!(await db.invoice.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
    case "TICKET":
      return !!(await db.ticket.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
    case "PROJECT":
      return !!(await db.project.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
    case "CAMPAIGN":
      return !!(await db.campaign.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
    case "EMPLOYEE":
      return !!(await db.employee.findUnique({ where: { id: entityId, companyId }, select: { id: true } }));
  }
}

export type DocumentUploadState = { ok?: number; error?: string } | undefined;

/** One or more files attached to a record. Returns a message for the form
 * instead of reloading, so the upload box can say exactly what happened. */
export async function uploadDocument(
  entityType: DocumentEntityType,
  entityId: string,
  redirectPath: string,
  _state: DocumentUploadState,
  formData: FormData
): Promise<DocumentUploadState> {
  const session = await verifySession();

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.name !== "");
  const blocker = uploadBlocker(files);
  if (blocker) return { error: blocker };

  const owned = await verifyEntityOwnership(entityType, entityId, session.companyId);
  if (!owned) return { error: "This record can't take documents." };

  for (const file of files) {
    await db.document.create({
      data: {
        filename: (file.name || "untitled").slice(0, 255),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: Buffer.from(await file.arrayBuffer()),
        companyId: session.companyId,
        entityType,
        entityId,
      },
    });
  }

  revalidatePath(redirectPath);
  return { ok: files.length };
}

export async function deleteDocument(documentId: string, redirectPath: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect(`${redirectPath}?error=forbidden`);
  }

  await db.document.delete({
    where: { id: documentId, companyId: session.companyId },
  });

  revalidatePath(redirectPath);
}
