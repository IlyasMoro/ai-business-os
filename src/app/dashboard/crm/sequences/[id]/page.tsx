import { formatDayMonth } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { customerScope } from "@/lib/crm-access";
import { PlanGate } from "@/components/billing/plan-gate";
import { BackButton } from "@/components/ui-dark/back-button";
import { Badge } from "@/components/ui-dark/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ENROLLMENT_LABELS, MAX_DELAY_DAYS, MAX_STEPS, PLACEHOLDERS, stepDays } from "@/lib/sequences";
import {
  addStep,
  deleteSequence,
  deleteStep,
  enrollGroup,
  renameSequence,
  setSequenceActive,
  stopEnrollment,
  updateStep,
} from "@/lib/actions/sequences";

export const metadata = { title: "Email sequence" };

const shortDate = (d: Date) => formatDayMonth(d);

function StepFields({ step, first, prefix }: { step?: { subject: string; body: string; delayDays: number }; first: boolean; prefix: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div>
          <Label htmlFor={`${prefix}-delay`}>{first ? "Send after (days)" : "Wait (days)"}</Label>
          <Input id={`${prefix}-delay`} name="delayDays" type="number" min={0} max={MAX_DELAY_DAYS} defaultValue={step?.delayDays ?? (first ? 0 : 3)} required />
        </div>
        <div>
          <Label htmlFor={`${prefix}-subject`}>Subject</Label>
          <Input id={`${prefix}-subject`} name="subject" required maxLength={200} defaultValue={step?.subject} placeholder="Quick question, {{first_name}}" />
        </div>
      </div>
      <div>
        <Label htmlFor={`${prefix}-body`}>Message</Label>
        <Textarea
          id={`${prefix}-body`}
          name="body"
          required
          rows={6}
          maxLength={10000}
          defaultValue={step?.body}
          placeholder={"Hi {{first_name}},\n\nThanks for your interest in {{my_company}}...\n\n{{sender_name}}"}
        />
      </div>
    </>
  );
}

/** One sequence: its emails in order, who is in it, and adding more people. */
export default async function SequencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; added?: string; skipped?: string }>;
}) {
  const { id } = await params;
  const { error, saved, added, skipped } = await searchParams;
  const session = await verifySession();
  if (!(await hasFeature(session.companyId, "automation"))) return <PlanGate feature="automation">{null}</PlanGate>;
  const isAdmin = hasRole(session, ["OWNER", "ADMIN"]);

  const sequence = await db.emailSequence.findFirst({
    where: { id, companyId: session.companyId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!sequence) notFound();

  const scope = await customerScope();
  const [enrollments, tags, leadCount] = await Promise.all([
    db.sequenceEnrollment.findMany({
      where: { sequenceId: id, customer: scope },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        status: true,
        sent: true,
        nextSendAt: true,
        endReason: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
    db.customerTag.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { customers: true } } } }),
    db.customer.count({ where: { companyId: session.companyId, status: "LEAD", ...scope } }),
  ]);
  const days = stepDays(sequence.steps.map((s) => s.delayDays));
  const toggle = setSequenceActive.bind(null, id, !sequence.active);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/crm/sequences" label="Back to sequences" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{sequence.name}</h1>
            {sequence.active ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <form action={toggle}>
                <SubmitButton variant={sequence.active ? "secondary" : "primary"} pendingText="Saving...">
                  {sequence.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {sequence.active ? "Pause" : "Switch on"}
                </SubmitButton>
              </form>
              <DeleteButton action={deleteSequence.bind(null, id)} confirmMessage="Delete this sequence? Nobody in it gets any more of its emails." />
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          {sequence.active
            ? "Emails go out as they fall due, checked every 15 minutes."
            : "Paused: nothing is sent until it's switched on. People in it keep their place."}
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {(saved || added !== undefined) && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              {added !== undefined
                ? `Added ${Number(added) || 0} ${Number(added) === 1 ? "customer" : "customers"}.${
                    Number(skipped) > 0 ? ` ${skipped} skipped: no email, unsubscribed, or already in it.` : ""
                  }`
                : "Saved."}
            </div>
          )}
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            {isAdmin && (
              <form action={renameSequence.bind(null, id)} className="flex flex-wrap items-center gap-2">
                <Input name="name" defaultValue={sequence.name} required maxLength={80} aria-label="Sequence name" className="min-w-0 flex-1" />
                <SubmitButton variant="secondary" pendingText="Saving...">
                  Rename
                </SubmitButton>
              </form>
            )}

            {sequence.steps.map((step, i) => (
              <Card key={step.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    Email {i + 1} <span className="ml-1 text-sm font-normal text-slate-500">day {days[i]}</span>
                  </CardTitle>
                  {isAdmin && <DeleteButton action={deleteStep.bind(null, id, step.id)} confirmMessage="Remove this email from the sequence?" label="" />}
                </CardHeader>
                <CardContent>
                  {isAdmin ? (
                    <form action={updateStep.bind(null, id, step.id)} className="space-y-3">
                      <StepFields step={step} first={i === 0} prefix={step.id} />
                      <SubmitButton variant="secondary" pendingText="Saving...">
                        Save email
                      </SubmitButton>
                    </form>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-slate-50 light:text-slate-900">{step.subject}</p>
                      <p className="whitespace-pre-wrap text-slate-300 light:text-slate-600">{step.body}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {isAdmin && sequence.steps.length < MAX_STEPS && (
              <Card id="new-step" className="scroll-mt-24">
                <CardHeader>
                  <CardTitle>{sequence.steps.length === 0 ? "Write the first email" : `Add email ${sequence.steps.length + 1}`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={addStep.bind(null, id)} className="space-y-3">
                    <StepFields first={sequence.steps.length === 0} prefix="new" />
                    <SubmitButton pendingText="Adding...">Add email</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add customers</CardTitle>
              </CardHeader>
              <CardContent>
                {sequence.steps.length === 0 ? (
                  <p className="text-sm text-slate-500">Write at least one email first.</p>
                ) : (
                  <form action={enrollGroup.bind(null, id)} className="space-y-3">
                    <Select name="group" aria-label="Who to add" required>
                      <option value="leads">Every lead ({leadCount})</option>
                      {tags.map((t) => (
                        <option key={t.id} value={`tag:${t.id}`}>
                          Tagged {t.name} ({t._count.customers})
                        </option>
                      ))}
                    </Select>
                    <SubmitButton variant="secondary" pendingText="Adding...">
                      Add them
                    </SubmitButton>
                    <p className="text-xs text-slate-500">
                      Customers without an email, who unsubscribed, or who are in it already are skipped. You can also add one customer from their page.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Placeholders</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {PLACEHOLDERS.map((p) => (
                    <li key={p.tag} className="flex items-center justify-between gap-3">
                      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-blue-300 light:bg-slate-100 light:text-blue-700">{p.tag}</code>
                      <span className="text-slate-400 light:text-slate-500">{p.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">Every email ends with an unsubscribe link.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>People in it ({enrollments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {enrollments.length === 0 ? (
                  <p className="text-sm text-slate-500">Nobody yet.</p>
                ) : (
                  <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                    {enrollments.map((e) => {
                      const label = ENROLLMENT_LABELS[e.status];
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <div className="min-w-0">
                            <Link href={`/dashboard/crm/${e.customer.id}`} className="block truncate font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                              {e.customer.name}
                            </Link>
                            <p className="truncate text-xs text-slate-500">
                              {e.sent} of {sequence.steps.length} sent
                              {e.status === "ACTIVE" && e.nextSendAt ? ` · next ${shortDate(e.nextSendAt)}` : ""}
                              {e.status !== "ACTIVE" && e.endReason ? ` · ${e.endReason}` : ""}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1">
                            <Badge tone={label.tone}>{label.label}</Badge>
                            {e.status === "ACTIVE" && (
                              <form action={stopEnrollment.bind(null, e.id)}>
                                <SubmitButton variant="ghost" pendingText="..." className="px-2 py-1 text-xs">
                                  Stop
                                </SubmitButton>
                              </form>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
