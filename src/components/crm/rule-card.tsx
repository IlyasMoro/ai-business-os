"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui-dark/badge";
import { Button } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { RuleForm, type RuleDefaults } from "@/components/crm/rule-form";
import type { RuleFormState } from "@/lib/actions/crm-rules";

type Option = { id: string; name: string };

/** One rule: its sentence, how often it ran, and on/off, edit and delete. */
export function RuleCard({
  rule,
  sentence,
  runs,
  lastRun,
  save,
  toggle,
  remove,
  users,
  tags,
  sequences,
}: {
  rule: RuleDefaults & { active: boolean };
  sentence: string;
  runs: number;
  lastRun: string | null;
  save: (state: RuleFormState, formData: FormData) => Promise<RuleFormState>;
  toggle: () => Promise<void>;
  remove: () => Promise<void>;
  users: Option[];
  tags: Option[];
  sequences: Option[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
      {editing ? (
        <RuleForm action={save} defaults={rule} users={users} tags={tags} sequences={sequences} submitLabel="Save rule" onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-50 light:text-slate-900">{rule.name}</p>
              {rule.active ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-300 light:text-slate-600">{sentence}</p>
            <p className="mt-1 text-xs text-slate-500">
              {runs === 0 ? "Hasn't run yet" : `Ran ${runs} ${runs === 1 ? "time" : "times"}${lastRun ? `, last on ${lastRun}` : ""}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <form action={toggle}>
              <Button type="submit" variant="secondary" size="sm">
                {rule.active ? "Turn off" : "Turn on"}
              </Button>
            </form>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <DeleteButton action={remove} confirmMessage={`Delete the rule "${rule.name}"?`} label="" />
          </div>
        </div>
      )}
    </div>
  );
}
