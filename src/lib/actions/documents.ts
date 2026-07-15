"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { DocumentEntityType } from "@/generated/prisma/client";

const MAX_SIZE_BYTES = 8 * 1024 * 1024;

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

export async function uploadDocument(
  entityType: DocumentEntityType,
  entityId: string,
  redirectPath: string,
  formData: FormData
) {
  const session = await verifySession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${redirectPath}?error=invalid`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    redirect(`${redirectPath}?error=invalid`);
  }

  const owned = await verifyEntityOwnership(entityType, entityId, session.companyId);
  if (!owned) {
    redirect(`${redirectPath}?error=invalid`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await db.document.create({
    data: {
      filename: file.name || "untitled",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data: buffer,
      companyId: session.companyId,
      entityType,
      entityId,
    },
  });

  revalidatePath(redirectPath);
  redirect(redirectPath);
}

export async function deleteDocument(documentId: string, redirectPath: string) {
  const session = await verifySession();

  await db.document.delete({
    where: { id: documentId, companyId: session.companyId },
  });

  revalidatePath(redirectPath);
}
