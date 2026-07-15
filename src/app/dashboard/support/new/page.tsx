import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { TicketForm } from "@/components/support/ticket-form";
import { createTicket } from "@/lib/actions/support";

export default async function NewTicketPage() {
  const session = await verifySession();

  const [customers, employees] = await Promise.all([
    db.customer.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.employee.findMany({
      where: { companyId: session.companyId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New ticket</h1>
      <div className="mt-6">
        <TicketForm
          action={createTicket}
          customers={customers}
          employees={employees}
          submitLabel="Create ticket"
        />
      </div>
    </div>
  );
}
