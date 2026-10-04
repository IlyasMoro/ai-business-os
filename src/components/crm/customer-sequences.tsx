import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { enrollCustomer, stopEnrollment } from "@/lib/actions/sequences";
import { ENROLLMENT_LABELS } from "@/lib/sequences";

type Enrollment = {
  id: string;
  status: keyof typeof ENROLLMENT_LABELS;
  sent: number;
  nextSendAt: Date | null;
  endReason: string | null;
  sequence: { id: string; name: string; active: boolean; _count: { steps: number } };
};

const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** The email sequences a customer is in, and a way to add them to one. */
export function CustomerSequences({
  customerId,
  enrollments,
  sequences,
  allowed,
  blocked,
}: {
  customerId: string;
  enrollments: Enrollment[];
  /** Sequences that are switched on and have emails. */
  sequences: { id: string; name: string }[];
  /** Whether the plan has Automations. */
  allowed: boolean;
  /** Why they can't get sequence emails, or null when they can. */
  blocked: "no-email" | "unsubscribed" | null;
}) {
  const inActive = new Set(enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.sequence.id));
  const available = sequences.filter((s) => !inActive.has(s.id));

  return (
    <Card id="sequences" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Email sequences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrollments.length > 0 && (
          <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
            {enrollments.map((e) => {
              const label = ENROLLMENT_LABELS[e.status];
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/dashboard/crm/sequences/${e.sequence.id}`} className="font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                      {e.sequence.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {e.sent} of {e.sequence._count.steps} sent
                      {e.status === "ACTIVE" && e.nextSendAt && (e.sequence.active ? ` · next on ${shortDate(e.nextSendAt)}` : " · sequence paused")}
                      {e.status !== "ACTIVE" && e.endReason ? ` · ${e.endReason}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={label.tone}>{label.label}</Badge>
                    {e.status === "ACTIVE" && (
                      <form action={stopEnrollment.bind(null, e.id)}>
                        <SubmitButton variant="ghost" pendingText="Stopping..." className="px-2 py-1 text-xs">
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

        {!allowed ? (
          <p className="text-sm text-slate-500">Email sequences come with the Growth plan and up.</p>
        ) : blocked === "unsubscribed" ? (
          <p className="text-sm text-slate-500">They unsubscribed, so they can&apos;t be put in a sequence.</p>
        ) : blocked === "no-email" ? (
          <p className="text-sm text-slate-500">Add an email address to put this customer in a sequence.</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-slate-500">
            {sequences.length === 0 ? (
              <>
                No sequences are switched on yet.{" "}
                <Link href="/dashboard/crm/sequences" className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                  Set one up
                </Link>
              </>
            ) : (
              "They're already in every sequence that's switched on."
            )}
          </p>
        ) : (
          <form action={enrollCustomer} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="customerId" value={customerId} />
            <Select name="sequenceId" aria-label="Sequence" className="w-auto min-w-48 flex-1" required>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <SubmitButton variant="secondary" pendingText="Adding...">
              Add to sequence
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
