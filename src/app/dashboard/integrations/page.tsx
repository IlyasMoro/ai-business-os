import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { disconnectGoogle, sendTestEmail } from "@/lib/actions/integrations";
import { Mail } from "lucide-react";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; testsent?: string }>;
}) {
  const { error, connected, testsent } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const integration = await db.googleIntegration.findUnique({
    where: { companyId: session.companyId },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Integrations</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Connect third-party accounts so this app can act on your behalf.
      </p>

      <div className="mt-4 max-w-2xl">
        <ErrorBanner code={error} />
        {connected && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Gmail connected successfully.
          </div>
        )}
        {testsent && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Test email sent. Check your inbox.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-slate-50 light:text-slate-900">Gmail</p>
              {integration ? (
                <p className="text-sm text-emerald-400">Connected as {integration.email}</p>
              ) : (
                <p className="text-sm text-slate-400 light:text-slate-500">
                  Not connected. Emails currently send via the app&apos;s default provider.
                </p>
              )}
            </div>
          </div>

          {integration ? (
            <form action={disconnectGoogle}>
              <SubmitButton variant="ghost" pendingText="Disconnecting...">
                Disconnect
              </SubmitButton>
            </form>
          ) : (
            <a
              href="/api/integrations/google/connect"
              className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
            >
              Connect
            </a>
          )}
        </div>

        {integration && (
          <form action={sendTestEmail} className="mt-4 border-t border-white/[0.06] light:border-slate-200 pt-4">
            <SubmitButton variant="secondary" pendingText="Sending...">
              Send test email
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
