import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { TicketStatusForm } from "@/components/support/ticket-status-form";
import { TicketMessageForm } from "@/components/support/ticket-message-form";
import { DocumentsSection } from "@/components/documents/documents-section";
import { deleteTicket, deleteTicketMessage } from "@/lib/actions/support";
import { formatDistanceToNow } from "date-fns";
import { Pencil } from "lucide-react";

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

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const ticket = await db.ticket.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      assignee: true,
      messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) notFound();

  const documents = await db.document.findMany({
    where: { companyId: session.companyId, entityType: "TICKET", entityId: ticket.id },
    select: { id: true, filename: true, size: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{ticket.subject}</h1>
              <Badge tone={statusTone[ticket.status]}>{ticket.status}</Badge>
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">For {ticket.customer.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              Created {ticket.createdAt.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TicketStatusForm ticketId={ticket.id} status={ticket.status} />
            <LinkButton href={`/dashboard/support/${ticket.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteTicket.bind(null, ticket.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-slate-500">Priority</p>
              <Badge tone={priorityTone[ticket.priority]}>{ticket.priority}</Badge>
            </div>
            <div>
              <p className="text-slate-500">Description</p>
              <p className="text-slate-50 light:text-slate-900">{ticket.description ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Assignee</p>
              <p className="text-slate-50 light:text-slate-900">{ticket.assignee?.name ?? "Unassigned"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            {ticket.messages.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No replies yet.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {ticket.messages.map((message) => (
                  <li key={message.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="text-slate-50 light:text-slate-900">{message.content}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {message.authorType === "STAFF" ? message.author?.name ?? "Staff" : ticket.customer.name}
                        {" · "}
                        {formatDistanceToNow(message.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteTicketMessage.bind(null, ticket.id, message.id)}
                      confirmMessage="Delete this message?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <TicketMessageForm ticketId={ticket.id} />
          </CardContent>
        </Card>

        <DocumentsSection
          entityType="TICKET"
          entityId={ticket.id}
          redirectPath={`/dashboard/support/${ticket.id}`}
          documents={documents}
        />

        <p className="mt-6">
          <Link href="/dashboard/support" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to support
          </Link>
        </p>
      </div>
    </div>
  );
}
