"use server";

import { verifySessionAnywhere, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { customerScope } from "@/lib/crm-access";

export type SearchHit = {
  kind: "Customer" | "Product" | "Order" | "Invoice" | "Supplier" | "Employee";
  title: string;
  detail: string;
  href: string;
};

const LIMIT = 5;

/**
 * Records matching `query` for the Ctrl K search: customers, products,
 * orders, invoices, suppliers and (owners and admins only) employees, in
 * the signed in company. Customers follow the CRM's "own customers only"
 * rule, like the CRM pages. A few results per kind, best kinds first.
 */
export async function searchRecords(query: string): Promise<SearchHit[]> {
  // Works from any page; the role's modules decide which kinds are searched.
  const session = await verifySessionAnywhere();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const companyId = session.companyId;
  const like = { contains: q, mode: "insensitive" as const };
  const backOffice = hasRole(session, ["OWNER", "ADMIN"]);
  // With a company role, only the modules it can open are searched.
  const can = (key: "crm" | "inventory" | "sales" | "invoicing" | "procurement" | "hr") => !session.access || Boolean(session.access[key]);
  const none = Promise.resolve([] as never[]);
  const scope = await customerScope();
  // Orders and invoices of customers this user may not see stay hidden.
  const ofVisibleCustomers = Object.keys(scope).length > 0 ? { customer: scope } : {};

  const [customers, products, orders, invoices, suppliers, employees] = await Promise.all([
    !can("crm") ? none : db.customer.findMany({
      where: { companyId, ...scope, OR: [{ name: like }, { company: like }, { email: like }, { phone: like }] },
      select: { id: true, name: true, company: true, status: true },
      take: LIMIT,
      orderBy: { name: "asc" },
    }),
    !can("inventory") ? none : db.product.findMany({
      where: { companyId, OR: [{ name: like }, { sku: like }] },
      select: { id: true, name: true, sku: true },
      take: LIMIT,
      orderBy: { name: "asc" },
    }),
    !can("sales") ? none : db.order.findMany({
      where: { companyId, ...ofVisibleCustomers, OR: [{ orderNumber: like }, { customer: { name: like } }] },
      select: { id: true, orderNumber: true, status: true, customer: { select: { name: true } } },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    !can("invoicing") ? none : db.invoice.findMany({
      where: { companyId, ...ofVisibleCustomers, OR: [{ invoiceNumber: like }, { customer: { name: like } }] },
      select: { id: true, invoiceNumber: true, status: true, customer: { select: { name: true } } },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    !can("procurement") ? none : db.supplier.findMany({
      where: { companyId, OR: [{ name: like }, { email: like }] },
      select: { id: true, name: true, email: true },
      take: LIMIT,
      orderBy: { name: "asc" },
    }),
    backOffice && can("hr")
      ? db.employee.findMany({
          where: { companyId, OR: [{ name: like }, { email: like }, { position: like }] },
          select: { id: true, name: true, position: true },
          take: LIMIT,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const status = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  return [
    ...customers.map((c) => ({ kind: "Customer" as const, title: c.name, detail: [c.company, status(c.status)].filter(Boolean).join(" · "), href: `/dashboard/crm/${c.id}` })),
    ...products.map((p) => ({ kind: "Product" as const, title: p.name, detail: p.sku, href: `/dashboard/inventory/${p.id}` })),
    ...orders.map((o) => ({ kind: "Order" as const, title: o.orderNumber, detail: `${o.customer.name} · ${status(o.status)}`, href: `/dashboard/sales/${o.id}` })),
    ...invoices.map((i) => ({ kind: "Invoice" as const, title: i.invoiceNumber, detail: `${i.customer.name} · ${status(i.status)}`, href: `/dashboard/invoicing/${i.id}` })),
    ...suppliers.map((s) => ({ kind: "Supplier" as const, title: s.name, detail: s.email ?? "Supplier", href: `/dashboard/procurement/suppliers/${s.id}` })),
    ...employees.map((e) => ({ kind: "Employee" as const, title: e.name, detail: e.position ?? "Employee", href: `/dashboard/hr/${e.id}` })),
  ];
}
