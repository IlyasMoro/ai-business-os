import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { AutomationToggle } from "@/components/automation/automation-toggle";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { runAutomationsNow } from "@/lib/actions/automation";

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string }>;
}) {
  const { ran } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const settings = await db.automationSettings.findUnique({
    where: { companyId: session.companyId },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Automation</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Rules that run automatically against your data. No approval needed once enabled.
      </p>

      {ran && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          Automations ran successfully.
        </div>
      )}

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="divide-y divide-white/[0.06] light:divide-slate-200">
          <AutomationToggle
            toggleKey="overdueInvoiceReminders"
            enabled={settings?.overdueInvoiceReminders ?? false}
            label="Overdue invoice reminders"
            description="Email customers automatically when an invoice is overdue (at most once per day per invoice)."
          />
          <AutomationToggle
            toggleKey="lowStockReorder"
            enabled={settings?.lowStockReorder ?? false}
            label="Low-stock reorder drafts"
            description="Create a draft purchase order when a product's stock falls to or below its reorder level."
          />
          <AutomationToggle
            toggleKey="staleTicketEscalation"
            enabled={settings?.staleTicketEscalation ?? false}
            label="Stale ticket escalation"
            description="Bump a support ticket to high priority if it's been open more than 48 hours."
          />
          <AutomationToggle
            toggleKey="staleLeadCleanup"
            enabled={settings?.staleLeadCleanup ?? false}
            label="Stale lead cleanup"
            description="Mark a CRM lead inactive if it's been open 30+ days with no orders."
          />
        </div>
      </div>

      <form action={runAutomationsNow} className="mt-6 max-w-2xl">
        <SubmitButton variant="secondary" pendingText="Running...">
          Run automations now
        </SubmitButton>
      </form>
    </div>
  );
}
