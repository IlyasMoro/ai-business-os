import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifySession, hasRole } from "@/lib/dal";
import type { Prisma } from "@/generated/prisma/client";

/* Who sees which customers. With "own customers only" on in the CRM
   settings, an employee sees just the customers they own, plus the deals,
   quotes and reminders that belong to those customers or to them. Owners
   and admins always see everything. Each helper returns a where clause to
   spread into a query; it is empty when nothing is restricted. */

export const getCrmSettings = cache(async (companyId: string) => {
  return db.crmSettings.findUnique({ where: { companyId } });
});

/** The signed-in user's id when their CRM view is limited, else null. */
export const restrictedTo = cache(async (): Promise<string | null> => {
  const session = await verifySession();
  if (hasRole(session, ["OWNER", "ADMIN"])) return null;
  const settings = await getCrmSettings(session.companyId);
  return settings?.ownCustomersOnly ? session.userId : null;
});

export async function customerScope(): Promise<Prisma.CustomerWhereInput> {
  const userId = await restrictedTo();
  return userId ? { ownerId: userId } : {};
}

export async function dealScope(): Promise<Prisma.DealWhereInput> {
  const userId = await restrictedTo();
  return userId ? { OR: [{ ownerId: userId }, { customer: { ownerId: userId } }] } : {};
}

export async function quoteScope(): Promise<Prisma.QuoteWhereInput> {
  const userId = await restrictedTo();
  return userId ? { OR: [{ ownerId: userId }, { customer: { ownerId: userId } }] } : {};
}

export async function followUpScope(): Promise<Prisma.FollowUpWhereInput> {
  const userId = await restrictedTo();
  return userId ? { OR: [{ assigneeId: userId }, { customer: { ownerId: userId } }] } : {};
}

/** For pages and actions on one customer: 404 when it isn't theirs to see. */
export async function assertCustomerVisible(companyId: string, customerId: string) {
  const found = await db.customer.findFirst({ where: { id: customerId, companyId, ...(await customerScope()) }, select: { id: true } });
  if (!found) notFound();
}
