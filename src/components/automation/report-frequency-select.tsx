"use client";

import { useRef } from "react";
import { updateReportFrequency } from "@/lib/actions/automation";

const OPTIONS = [
  { value: "OFF", label: "Off" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
] as const;

export function ReportFrequencySelect({ value }: { value: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateReportFrequency} className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="font-medium text-slate-50 light:text-slate-900">Scheduled PDF business report</p>
        <p className="mt-0.5 text-sm text-slate-400 light:text-slate-500">
          Emails every Owner and Admin a PDF report (revenue, expenses, order and invoice status) on this cadence.
        </p>
      </div>
      <select
        name="reportFrequency"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className="shrink-0 rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white px-3 py-2 text-sm text-slate-50 light:text-slate-900 outline-none transition-colors focus:border-blue-500"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </form>
  );
}
