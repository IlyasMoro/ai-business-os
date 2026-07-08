import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ContactForm } from "@/components/crm/contact-form";
import { deleteCustomer, deleteContact } from "@/lib/actions/crm";
import { Pencil } from "lucide-react";

const statusTone = {
  LEAD: "yellow",
  ACTIVE: "green",
  INACTIVE: "slate",
} as const;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const customer = await db.customer.findUnique({
    where: { id, companyId: session.companyId },
    include: { contacts: true },
  });

  if (!customer) notFound();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[#0B1120] p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        <ErrorBanner code={error} />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50">{customer.name}</h1>
              <Badge tone={statusTone[customer.status]}>{customer.status}</Badge>
            </div>
            {customer.company && <p className="mt-1 text-slate-400">{customer.company}</p>}
          </div>
          <div className="flex items-center gap-2">
            <LinkButton href={`/dashboard/crm/${customer.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteCustomer.bind(null, customer.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Email</p>
              <p className="text-slate-50">{customer.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="text-slate-50">{customer.phone ?? "—"}</p>
            </div>
            {customer.notes && (
              <div className="col-span-2">
                <p className="text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap text-slate-50">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.contacts.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06]">
                {customer.contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-50">
                        {contact.name}{" "}
                        {contact.role && (
                          <span className="font-normal text-slate-500">— {contact.role}</span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteContact.bind(null, customer.id, contact.id)}
                      confirmMessage="Remove this contact?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <ContactForm customerId={customer.id} />
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/crm" className="text-sm text-slate-500 hover:text-slate-300">
            ← Back to customers
          </Link>
        </p>
      </div>
    </div>
  );
}
