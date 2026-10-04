"use client";

import { useActionState, useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { Button } from "@/components/ui-dark/button";
import { DEAL_STAGES } from "@/lib/crm-pipeline";
import { RULE_ACTIONS, RULE_TRIGGERS, type RuleAction, type RuleTrigger } from "@/lib/crm-rules";
import type { RuleFormState } from "@/lib/actions/crm-rules";

type Option = { id: string; name: string };

export type RuleDefaults = {
  name: string;
  trigger: RuleTrigger;
  stage: string | null;
  quietDays: number | null;
  action: RuleAction;
  title: string | null;
  dueInDays: number | null;
  assigneeId: string | null;
  tagId: string | null;
  sequenceId: string | null;
  status: string | null;
  message: string | null;
};

/** A rule as two halves, "When" and "Then", each showing only the fields
 * its choice needs. */
export function RuleForm({
  action,
  defaults,
  users,
  tags,
  sequences,
  submitLabel,
  onCancel,
}: {
  action: (state: RuleFormState, formData: FormData) => Promise<RuleFormState>;
  defaults?: RuleDefaults;
  users: Option[];
  tags: Option[];
  sequences: Option[];
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [trigger, setTrigger] = useState<RuleTrigger>(defaults?.trigger ?? "DEAL_WON");
  const [act, setAct] = useState<RuleAction>(defaults?.action ?? "CREATE_REMINDER");
  const id = (name: string) => `${defaults ? "edit" : "new"}-${name}`;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor={id("name")}>Rule name</Label>
        <Input id={id("name")} name="name" required maxLength={80} defaultValue={defaults?.name} placeholder="For example, Book delivery when won" />
      </div>

      <fieldset className="rounded-xl border border-white/[0.08] p-4 light:border-slate-200">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-blue-300 light:text-blue-700">When</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select name="trigger" aria-label="When" value={trigger} onChange={(e) => setTrigger(e.target.value as RuleTrigger)}>
            {RULE_TRIGGERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          {trigger === "DEAL_STAGE" && (
            <Select name="stage" aria-label="Stage" defaultValue={defaults?.stage ?? "PROPOSAL"}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
          {trigger === "CUSTOMER_QUIET" && (
            <div className="flex items-center gap-2">
              <Input name="quietDays" type="number" min={1} max={365} defaultValue={defaults?.quietDays ?? 30} aria-label="Days without contact" className="w-24" />
              <span className="text-sm text-slate-400 light:text-slate-500">days without contact</span>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-white/[0.08] p-4 light:border-slate-200">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-emerald-300 light:text-emerald-700">Then</legend>
        <div className="space-y-3">
          <Select name="action" aria-label="Then" value={act} onChange={(e) => setAct(e.target.value as RuleAction)}>
            {RULE_ACTIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>

          {act === "CREATE_REMINDER" && (
            <>
              <div>
                <Label htmlFor={id("title")}>Reminder</Label>
                <Input id={id("title")} name="title" maxLength={200} defaultValue={defaults?.title ?? ""} placeholder="Book the delivery for {{customer}}" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={id("due")}>Due after (days)</Label>
                  <Input id={id("due")} name="dueInDays" type="number" min={0} max={365} defaultValue={defaults?.dueInDays ?? 1} />
                </div>
                <PersonSelect id={id("who")} users={users} value={defaults?.assigneeId} label="For" />
              </div>
            </>
          )}
          {act === "EMAIL_PERSON" && (
            <>
              <PersonSelect id={id("who")} users={users} value={defaults?.assigneeId} label="Send to" />
              <div>
                <Label htmlFor={id("message")}>Message</Label>
                <Textarea id={id("message")} name="message" rows={3} maxLength={2000} defaultValue={defaults?.message ?? ""} placeholder="{{customer}} just signed. Please arrange delivery." />
              </div>
            </>
          )}
          {act === "ADD_TAG" &&
            (tags.length === 0 ? (
              <p className="text-sm text-slate-400 light:text-slate-500">Add tags in the CRM settings first.</p>
            ) : (
              <Select name="tagId" aria-label="Tag" defaultValue={defaults?.tagId ?? tags[0].id}>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ))}
          {act === "SET_STATUS" && (
            <Select name="status" aria-label="Status" defaultValue={defaults?.status ?? "ACTIVE"}>
              <option value="LEAD">Lead</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          )}
          {act === "ADD_TO_SEQUENCE" &&
            (sequences.length === 0 ? (
              <p className="text-sm text-slate-400 light:text-slate-500">Create an email sequence first.</p>
            ) : (
              <Select name="sequenceId" aria-label="Sequence" defaultValue={defaults?.sequenceId ?? sequences[0].id}>
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ))}
          {(act === "CREATE_REMINDER" || act === "EMAIL_PERSON") && (
            <p className="text-xs text-slate-500">
              <code className="text-blue-300 light:text-blue-700">{"{{customer}}"}</code> is replaced with the customer&apos;s name.
            </p>
          )}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-red-400 light:text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function PersonSelect({ id, users, value, label }: { id: string; users: Option[]; value?: string | null; label: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name="assigneeId" defaultValue={value ?? ""}>
        <option value="">The customer&apos;s owner</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
