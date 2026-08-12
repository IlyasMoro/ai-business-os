import { NextResponse } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";

// Full-company data export for disaster recovery / portability. Owner only,
// since this pulls every business record a company has (including payroll
// and PII) into one downloadable file. Excludes auth secrets (User.passwordHash,
// TeamInvite.tokenHash), live OAuth credentials (GoogleIntegration), and raw
// document bytes (Document.data) — those either shouldn't leave the server in
// a portable file or aren't practical to embed as JSON.
export async function GET() {
  const session = await requireRole(["OWNER"]);
  const companyId = session.companyId;

  const [
    company,
    users,
    teamInvites,
    customers,
    products,
    suppliers,
    purchaseOrders,
    orders,
    invoices,
    transactions,
    employees,
    payrollRuns,
    projects,
    tickets,
    campaigns,
    calendarEvents,
    documents,
    automationSettings,
    subscription,
    aiActions,
    chatMessages,
    auditLogs,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
        invitedByUserId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.customer.findMany({ where: { companyId }, include: { contacts: true }, orderBy: { createdAt: "asc" } }),
    db.product.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.supplier.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.purchaseOrder.findMany({ where: { companyId }, include: { items: true }, orderBy: { createdAt: "asc" } }),
    db.order.findMany({ where: { companyId }, include: { items: true }, orderBy: { createdAt: "asc" } }),
    db.invoice.findMany({ where: { companyId }, include: { lineItems: true }, orderBy: { createdAt: "asc" } }),
    db.transaction.findMany({ where: { companyId }, orderBy: { date: "asc" } }),
    db.employee.findMany({ where: { companyId }, orderBy: { hireDate: "asc" } }),
    db.payrollRun.findMany({ where: { companyId }, include: { items: true }, orderBy: { periodStart: "asc" } }),
    db.project.findMany({
      where: { companyId },
      include: { tasks: { include: { comments: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.ticket.findMany({ where: { companyId }, include: { messages: true }, orderBy: { createdAt: "asc" } }),
    db.campaign.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.calendarEvent.findMany({ where: { companyId }, orderBy: { startAt: "asc" } }),
    db.document.findMany({
      where: { companyId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.automationSettings.findUnique({ where: { companyId } }),
    db.subscription.findUnique({ where: { companyId } }),
    db.aiAction.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.aiChatMessage.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    db.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);

  const backup = {
    format: "aibos.backup.v1",
    exportedAt: new Date().toISOString(),
    exportedByUserId: session.userId,
    company,
    users,
    teamInvites,
    customers,
    products,
    suppliers,
    purchaseOrders,
    orders,
    invoices,
    transactions,
    employees,
    payrollRuns,
    projects,
    tickets,
    campaigns,
    calendarEvents,
    documents,
    automationSettings,
    subscription,
    aiActions,
    chatMessages,
    auditLogs,
  };

  const json = JSON.stringify(backup, null, 2);
  const datestamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aibos-backup-${datestamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
