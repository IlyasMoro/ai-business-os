import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  LEAD: "yellow",
  ACTIVE: "green",
  INACTIVE: "slate",
} as const;

export default async function CrmPage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/crm/new">
          <Plus className="h-4 w-4" />
          New customer
        </LinkButton>
      </div>

      <Card className="mt-6">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No customers yet. Add your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/crm/${customer.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{customer.company ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{customer.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[customer.status]}>{customer.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
