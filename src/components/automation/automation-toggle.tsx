"use client";

import { useRef } from "react";
import { toggleAutomation } from "@/lib/actions/automation";

type ToggleKey =
  | "overdueInvoiceReminders"
  | "lowStockReorder"
  | "staleTicketEscalation"
  | "staleLeadCleanup";

export function AutomationToggle({
  toggleKey,
  enabled,
  label,
  description,
}: {
  toggleKey: ToggleKey;
  enabled: boolean;
  label: string;
  description: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const action = toggleAutomation.bind(null, toggleKey);

  return (
    <form ref={formRef} action={action} className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="font-medium text-slate-50 light:text-slate-900">{label}</p>
        <p className="mt-0.5 text-sm text-slate-400 light:text-slate-500">{description}</p>
      </div>
      <input ref={hiddenRef} type="hidden" name="enabled" defaultValue={enabled ? "true" : "false"} />
      <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-white/10 transition-colors has-[:checked]:bg-emerald-500/80">
        <input
          type="checkbox"
          defaultChecked={enabled}
          className="peer sr-only"
          onChange={(e) => {
            if (hiddenRef.current) hiddenRef.current.value = e.target.checked ? "true" : "false";
            formRef.current?.requestSubmit();
          }}
        />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-slate-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </label>
    </form>
  );
}
