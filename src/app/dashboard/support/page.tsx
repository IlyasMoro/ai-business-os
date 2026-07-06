import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  OPEN: "blue",
  IN_PROGRESS: "purple",
  RESOLVED: "green",
  CLOSED: "slate",
} as const;

const priorityTone = {
  LOW: "slate",
  MEDIUM: "yellow",
  HIGH: "red",
} as const;

export default async function SupportPage() {
  const session = await verifySession();

  const tickets = await db.ticket.findMany({
    where: { companyId: session.companyId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Support</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/support/new">
          <Plus className="h-4 w-4" />
          New ticket
        </LinkButton>
      </div>

      <Card className="mt-6">
        {tickets.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No tickets yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/support/${ticket.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ticket.customer.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[ticket.status]}>{ticket.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={priorityTone[ticket.priority]}>{ticket.priority}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {ticket.createdAt.toLocaleDateString()}
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
