"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui-dark/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui-dark/input";
import { cn } from "@/lib/utils";
import { MANAGER_MODULES, MODULES, type AccessLevel, type ModuleKey, type RoleAccess } from "@/lib/role-access";
import type { CompanyRoleFormState } from "@/lib/validation/roles";

const LEVELS: { value: "none" | AccessLevel; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View" },
  { value: "full", label: "Full" },
];

const SECTIONS = [...new Set(MODULES.map((m) => m.section))];

/**
 * Create or edit a company role: name, what it is for, its level (manager
 * or staff) and, per module, no access, view only or full. Manager pages
 * (reports, finance, HR, settings) only open for the manager level.
 */
export function RoleForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: CompanyRoleFormState, formData: FormData) => Promise<CompanyRoleFormState>;
  initial?: { name: string; description: string | null; baseRole: "ADMIN" | "EMPLOYEE"; access: RoleAccess };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [baseRole, setBaseRole] = useState<"ADMIN" | "EMPLOYEE">(initial?.baseRole ?? "EMPLOYEE");
  const [access, setAccess] = useState<RoleAccess>(initial?.access ?? {});
  const set = (key: ModuleKey, level: "none" | AccessLevel) =>
    setAccess((a) => {
      const next = { ...a };
      if (level === "none") delete next[key];
      else next[key] = level;
      return next;
    });

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Role name</Label>
          <Input id="name" name="name" defaultValue={initial?.name} placeholder="Head butcher" required maxLength={60} />
          <FieldError messages={state?.errors?.name} />
        </div>
        <div>
          <Label>Level</Label>
          <div role="radiogroup" aria-label="Level" className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "EMPLOYEE", title: "Staff", text: "Day to day work only" },
                { value: "ADMIN", title: "Manager", text: "Can also be given reports, finance, HR and settings" },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2 transition-colors",
                  baseRole === o.value
                    ? "border-blue-500 bg-blue-500/10 light:bg-blue-50"
                    : "border-white/[0.1] hover:border-white/25 light:border-slate-200 light:hover:border-slate-300"
                )}
              >
                <input type="radio" name="baseRole" value={o.value} checked={baseRole === o.value} onChange={() => setBaseRole(o.value)} className="sr-only" />
                <span className="block text-sm font-medium text-slate-100 light:text-slate-900">{o.title}</span>
                <span className="block text-xs text-slate-400 light:text-slate-500">{o.text}</span>
              </label>
            ))}
          </div>
          <FieldError messages={state?.errors?.baseRole} />
        </div>
      </div>

      <div>
        <Label htmlFor="description">What this role is for</Label>
        <Textarea id="description" name="description" defaultValue={initial?.description ?? ""} rows={2} maxLength={240} placeholder="Cuts and packs meat, counts stock at the end of the day." />
        <FieldError messages={state?.errors?.description} />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-200 light:text-slate-800">What this role can open</p>
        <p className="mt-0.5 text-xs text-slate-400 light:text-slate-500">
          View lets them look without changing anything. Full lets them create, edit and delete. Anything else stays hidden from them.
        </p>
        <FieldError messages={state?.errors?.access} />
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {SECTIONS.map((section) => (
            <fieldset key={section} className="rounded-xl border border-white/[0.08] p-3 light:border-slate-200">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400 light:text-slate-500">{section}</legend>
              <div className="space-y-1.5">
                {MODULES.filter((m) => m.section === section).map((m) => {
                  const locked = baseRole === "EMPLOYEE" && MANAGER_MODULES.has(m.key);
                  const current = locked ? "none" : (access[m.key] ?? "none");
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3">
                      <span className={cn("text-sm", locked ? "text-slate-500" : "text-slate-200 light:text-slate-700")}>
                        {m.label}
                        {locked && <span className="ml-1.5 text-xs text-slate-500">Manager level only</span>}
                      </span>
                      <div role="radiogroup" aria-label={m.label} className="inline-flex shrink-0 rounded-lg border border-white/[0.08] p-0.5 light:border-slate-200">
                        {LEVELS.map((l) => (
                          <label
                            key={l.value}
                            className={cn(
                              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                              locked ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                              current === l.value
                                ? l.value === "none"
                                  ? "bg-white/[0.08] text-slate-200 light:bg-slate-100 light:text-slate-700"
                                  : "bg-blue-600 text-white"
                                : "text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800"
                            )}
                          >
                            <input
                              type="radio"
                              name={`access_${m.key}`}
                              value={l.value}
                              checked={current === l.value}
                              disabled={locked}
                              onChange={() => set(m.key, l.value)}
                              className="sr-only"
                            />
                            {l.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {state?.message && <p className="text-sm text-red-400 light:text-red-700">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
