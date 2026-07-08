import "server-only";
import { db } from "@/lib/db";

export async function logAudit(
  companyId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: {
      companyId,
      userId,
      action,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}
