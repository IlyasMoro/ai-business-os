import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { AutomationToggle } from "@/components/automation/automation-toggle";
import { ReportFrequencySelect } from "@/components/automation/report-frequency-select";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { runAutomationsNow, updateWebhookUrl, clearWebhookUrl, sendTestWebhook } from "@/lib/actions/automation";
import { Webhook } from "lucide-react";

export default async function AutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string; error?: string; saved?: string; webhooktested?: string }>;
}) {
  const { ran, error, saved, webhooktested } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const settings = await db.automationSettings.findUnique({
    where: { companyId: session.companyId },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Automation rules</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Rules that run automatically against your data. No approval needed once enabled.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {ran && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Automations ran successfully.
          </div>
        )}
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </div>
        )}
        {webhooktested && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Test notification sent.
          </div>
        )}
      </div>

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
          <ReportFrequencySelect value={settings?.reportFrequency ?? "OFF"} />
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-slate-500">
        These rules and the scheduled report run automatically every 15 minutes via a GitHub Actions
        schedule, independent of anyone visiting this page.
      </p>

      <form action={runAutomationsNow} className="mt-6 max-w-2xl">
        <SubmitButton variant="secondary" pendingText="Running...">
          Run automations now
        </SubmitButton>
      </form>

      <div className="mt-8 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
            <Webhook className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50 light:text-slate-900">Webhook notifications</p>
            <p className="text-sm text-slate-400 light:text-slate-500">
              Posts a JSON notification whenever an enabled automation rule above fires, and on every
              new support ticket. Paste a Slack &quot;Incoming Webhook&quot; URL, a Zapier/Make catch
              hook, or any endpoint that accepts a JSON POST.
            </p>
          </div>
        </div>

        <form action={updateWebhookUrl} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              name="webhookUrl"
              type="password"
              placeholder={settings?.webhookUrl ? "•••••••••••••••• (configured, leave blank to keep)" : "https://hooks.slack.com/services/..."}
              autoComplete="off"
            />
          </div>
          <SubmitButton pendingText="Saving...">Save</SubmitButton>
        </form>

        {settings?.webhookUrl && (
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] light:border-slate-200 pt-4">
            <form action={sendTestWebhook}>
              <SubmitButton variant="secondary" pendingText="Sending...">
                Send test notification
              </SubmitButton>
            </form>
            <form action={clearWebhookUrl}>
              <SubmitButton variant="ghost" pendingText="Clearing...">
                Clear
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      {session.role === "OWNER" && (
        <div className="mt-8 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Data backup</h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Download every business record your company owns (customers, orders, invoices,
            transactions, employees, payroll, projects, tickets, campaigns, calendar, and AI
            activity) as a single JSON file. Login credentials and connected Google tokens are
            never included. This is a copy you control yourself, separate from whatever backup
            add-on is or is not enabled on the underlying Railway Postgres database.
          </p>
          <a
            href="/api/export/backup"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/[0.06] light:border-slate-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5 light:hover:bg-slate-100"
          >
            Download full backup (JSON)
          </a>
        </div>
      )}
    </div>
  );
}
