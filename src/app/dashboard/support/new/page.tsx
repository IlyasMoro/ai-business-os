import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { TicketForm } from "@/components/support/ticket-form";
import { createTicket } from "@/lib/actions/support";

export default async function NewTicketPage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-white">New ticket</h1>
      <div className="mt-6">
        <TicketForm action={createTicket} customers={customers} submitLabel="Create ticket" />
      </div>
    </div>
  );
}
