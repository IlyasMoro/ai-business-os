"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ENTERPRISE, enterpriseQuote, normalizeEnterprise, type EnterpriseConfig } from "@/lib/enterprise";
import type { BillingInterval } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/ui-dark/submit-button";

/* The Enterprise plan builder: users, branches, the EDI add on and AI
   request packs, with the price worked out as you go (lib/enterprise.ts).
   On the pricing page it is an estimate ("landing" tone, white card); on
   Billing it posts the choice to buyEnterprise ("app" tone, dark glass). */

const TONES = {
  landing: {
    label: "text-[13px] font-semibold text-[#3b4a63]",
    value: "font-bold tabular-nums text-[#0b1f5e]",
    muted: "text-[#6b7686]",
    box: "border-[#d5dce5] bg-[#f6f8fb]",
    step: "border-[#d5dce5] bg-white text-[#0b1f5e] hover:bg-[#eef2f7]",
    accent: "accent-cyan-500",
    line: "border-[#e6e9ee]",
  },
  app: {
    label: "text-sm font-medium text-slate-300 light:text-slate-700",
    value: "font-semibold tabular-nums text-slate-50 light:text-slate-900",
    muted: "text-slate-400 light:text-slate-500",
    box: "border-white/[0.08] bg-white/[0.03] light:border-slate-200 light:bg-slate-50",
    step: "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10 light:border-slate-300 light:bg-white light:text-slate-800",
    accent: "accent-blue-500",
    line: "border-white/[0.06] light:border-slate-200",
  },
} as const;

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Called with +1 or -1. */
  onChange: (delta: number) => void;
  tone: (typeof TONES)[keyof typeof TONES];
}) {
  const btn = cn("flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-40", tone.step);
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(-1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className={cn("w-8 text-center", tone.value)} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function EnterpriseBuilder({
  tone: toneName,
  interval,
  initial,
  minUsers = ENTERPRISE.minUsers,
  minBranches = 1,
  children,
}: {
  tone: keyof typeof TONES;
  interval: BillingInterval;
  initial?: EnterpriseConfig;
  /** At least the team's people and active branches, on Billing. */
  minUsers?: number;
  minBranches?: number;
  /** Rendered under the price, e.g. the form's submit button. */
  children?: React.ReactNode;
}) {
  const tone = TONES[toneName];
  const lowUsers = Math.max(ENTERPRISE.minUsers, Math.min(minUsers, ENTERPRISE.maxUsers));
  const [config, setConfig] = useState<EnterpriseConfig>(() =>
    normalizeEnterprise({
      ...(initial ?? {}),
      users: Math.max(initial?.users ?? 0, lowUsers),
      branches: Math.max(initial?.branches ?? ENTERPRISE.includedBranches, minBranches),
    })
  );
  // From the latest state, so quick repeated clicks each count.
  const update = (patch: Partial<EnterpriseConfig> | ((c: EnterpriseConfig) => Partial<EnterpriseConfig>)) =>
    setConfig((prev) => {
      const next = normalizeEnterprise({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) });
      next.users = Math.max(next.users, lowUsers);
      next.branches = Math.max(next.branches, minBranches);
      return next;
    });
  const quote = enterpriseQuote(config, interval);
  const per = interval === "monthly" ? "month" : "year";
  const aiTotal = ENTERPRISE.aiIncluded + config.aiPacks * ENTERPRISE.aiPackSize;

  return (
    <div className="space-y-4">
      {/* What the form posts. */}
      <input type="hidden" name="users" value={config.users} />
      <input type="hidden" name="branches" value={config.branches} />
      <input type="hidden" name="aiPacks" value={config.aiPacks} />
      <input type="hidden" name="interval" value={interval} />
      {config.edi && <input type="hidden" name="edi" value="on" />}

      <div className={cn("space-y-4 rounded-xl border p-4", tone.box)}>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`ent-users-${toneName}`} className={tone.label}>
              Users
            </label>
            <span className={tone.value}>{config.users}</span>
          </div>
          <input
            id={`ent-users-${toneName}`}
            type="range"
            min={lowUsers}
            max={ENTERPRISE.maxUsers}
            value={config.users}
            onChange={(e) => update({ users: Number(e.target.value) })}
            className={cn("mt-2 w-full", tone.accent)}
          />
          <p className={cn("mt-1 text-xs", tone.muted)}>
            ${ENTERPRISE.perUser} each a {interval === "monthly" ? "month" : "month, billed yearly"}, {lowUsers} or more
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={tone.label}>Branches</p>
            <p className={cn("text-xs", tone.muted)}>
              {ENTERPRISE.includedBranches} included, then ${ENTERPRISE.perBranch} each
            </p>
          </div>
          <Stepper label="Branches" value={config.branches} min={Math.max(1, minBranches)} max={ENTERPRISE.maxBranches} onChange={(delta) => update((c) => ({ branches: c.branches + delta }))} tone={tone} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={tone.label}>AI Copilot requests a month</p>
            <p className={cn("text-xs", tone.muted)}>
              {ENTERPRISE.aiIncluded.toLocaleString("en-US")} included, then ${ENTERPRISE.aiPackPrice} per {ENTERPRISE.aiPackSize}
            </p>
          </div>
          <div className="text-right">
            <Stepper label="AI request packs" value={config.aiPacks} min={0} max={ENTERPRISE.maxAiPacks} onChange={(delta) => update((c) => ({ aiPacks: c.aiPacks + delta }))} tone={tone} />
            <p className={cn("mt-1 text-xs tabular-nums", tone.muted)}>{aiTotal.toLocaleString("en-US")} a month</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className={cn("block", tone.label)}>EDI with your trading partners</span>
            <span className={cn("block text-xs", tone.muted)}>Add on, ${ENTERPRISE.ediPrice} a month</span>
          </span>
          <input type="checkbox" checked={config.edi} onChange={(e) => update({ edi: e.target.checked })} className={cn("h-4 w-4", tone.accent)} />
        </label>
      </div>

      <div>
        <ul className={cn("space-y-1 text-xs", tone.muted)}>
          {quote.lines.map((l) => (
            <li key={l.part} className="flex justify-between gap-3">
              <span>
                {l.label}
                {l.quantity > 1 && l.part !== "ai" && ` × $${l.unit.toLocaleString("en-US")}`}
              </span>
              <span className="tabular-nums">${l.amount.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ul>
        <p className={cn("mt-2 flex items-baseline justify-between border-t pt-2", tone.line)}>
          <span className={tone.label}>Total</span>
          <span className={cn("text-lg", tone.value)}>
            ${quote.total.toLocaleString("en-US")}
            <span className={cn("text-xs font-normal", tone.muted)}> / {per}</span>
          </span>
        </p>
      </div>

      {children}
    </div>
  );
}

/** Billing's Enterprise form: period switch, builder and one button that
 * subscribes (Stripe Checkout) or changes the plan in place. */
export function EnterpriseBuyForm({
  action,
  initial,
  initialInterval = "monthly",
  minUsers,
  minBranches,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial: EnterpriseConfig;
  initialInterval?: BillingInterval;
  minUsers: number;
  minBranches: number;
  submitLabel: string;
}) {
  const [interval, setBillingInterval] = useState<BillingInterval>(initialInterval);
  return (
    <form action={action} className="space-y-4">
      <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 light:border-slate-200 light:bg-slate-100">
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setBillingInterval(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              interval === value ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
            )}
          >
            {value === "monthly" ? "Monthly" : "Yearly"}
            {value === "yearly" && <span className="ml-1.5 text-xs opacity-80">2 months free</span>}
          </button>
        ))}
      </div>
      <EnterpriseBuilder tone="app" interval={interval} initial={initial} minUsers={minUsers} minBranches={minBranches}>
        <SubmitButton pendingText="Working...">{submitLabel}</SubmitButton>
      </EnterpriseBuilder>
    </form>
  );
}
