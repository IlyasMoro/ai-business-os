import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { TicketForm } from "@/components/support/ticket-form";
import { updateTicket } from "@/lib/actions/support";
import type { TicketFormState } from "@/lib/validation/support";

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const ticket = await db.ticket.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!ticket) notFound();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const action = updateTicket.bind(null, ticket.id) as (
    state: TicketFormState,
    formData: FormData
  ) => Promise<TicketFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">Edit ticket</h1>
      <div className="mt-6">
        <TicketForm
          action={action}
          customers={customers}
          defaultValues={{
            customerId: ticket.customerId,
            subject: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
