import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { createFollowUp, deleteFollowUp, toggleFollowUp } from "@/lib/actions/pipeline";
import { followUpBucket } from "@/lib/crm-pipeline";
import { cn } from "@/lib/utils";

export type ListFollowUp = {
  id: string;
  title: string;
  dueAt: Date;
  doneAt: Date | null;
  assignee: { name: string } | null;
  customer?: { id: string; name: string };
  deal?: { id: string; title: string } | null;
};

const BUCKET_STYLE = {
  overdue: "text-red-400 light:text-red-600",
  today: "text-amber-400 light:text-amber-600",
  upcoming: "text-slate-400 light:text-slate-500",
  done: "text-slate-500",
} as const;

function due(date: Date) {
  return date.toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One reminder row: tick to mark done (or undo), due date coloured by
 * overdue / today / later, and who it is for. */
export function FollowUpRow({ followUp, showCustomer = false }: { followUp: ListFollowUp; showCustomer?: boolean }) {
  const bucket = followUpBucket(followUp);
  const done = bucket === "done";
  return (
    <li className="flex items-start gap-3 py-2.5">
      <form action={toggleFollowUp.bind(null, followUp.id)}>
        <button
          type="submit"
          aria-label={done ? `Mark "${followUp.title}" as not done` : `Mark "${followUp.title}" as done`}
          className={cn(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            done ? "border-blue-500 bg-blue-600 text-white" : "border-white/25 hover:border-blue-400 light:border-slate-300"
          )}
        >
          {done && <Check aria-hidden className="h-3.5 w-3.5" />}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done ? "text-slate-500 line-through" : "text-slate-100 light:text-slate-800")}>{followUp.title}</p>
        <p className="text-xs">
          <span className={BUCKET_STYLE[bucket]}>
            {bucket === "overdue" ? "Overdue · " : bucket === "today" ? "Today · " : ""}
            {due(followUp.dueAt)}
          </span>
          <span className="text-slate-500">
            {followUp.assignee && ` · ${followUp.assignee.name}`}
            {showCustomer && followUp.customer && (
              <>
                {" · "}
                <Link href={`/dashboard/crm/${followUp.customer.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                  {followUp.customer.name}
                </Link>
              </>
            )}
            {followUp.deal && (
              <>
                {" · "}
                <Link href={`/dashboard/crm/deals/${followUp.deal.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                  {followUp.deal.title}
                </Link>
              </>
            )}
          </span>
        </p>
      </div>
      <DeleteButton action={deleteFollowUp.bind(null, followUp.id)} confirmMessage="Delete this reminder?" className="px-1.5" />
    </li>
  );
}

/** Reminders for one customer or deal, with a form to add one. Open ones
 * first by due date, then the last few done. */
export function FollowUpList({
  customerId,
  dealId,
  back,
  followUps,
  users,
  currentUserId,
}: {
  customerId: string;
  dealId?: string;
  back: string;
  followUps: ListFollowUp[];
  users: { id: string; name: string }[];
  currentUserId: string;
}) {
  const open = followUps.filter((f) => !f.doneAt).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const done = followUps.filter((f) => f.doneAt).slice(0, 5);
  const key = dealId ?? customerId;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createFollowUp} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          <input type="hidden" name="back" value={back} />
          <div>
            <Label htmlFor={`fu-title-${key}`}>What to do</Label>
            <Input id={`fu-title-${key}`} name="title" required maxLength={200} placeholder="Send the revised quote" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`fu-due-${key}`}>Due</Label>
              <Input id={`fu-due-${key}`} name="dueAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor={`fu-who-${key}`}>For</Label>
              <Select id={`fu-who-${key}`} name="assigneeId" defaultValue={currentUserId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.id === currentUserId ? `${user.name} (me)` : user.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <SubmitButton pendingText="Adding...">Add reminder</SubmitButton>
        </form>

        {open.length + done.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">No reminders. Add one so nothing slips.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06] light:divide-slate-200 light:border-slate-200">
            {[...open, ...done].map((f) => (
              <FollowUpRow key={f.id} followUp={f} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
