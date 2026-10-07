import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getReturnPolicy } from "@/lib/returns-policy";
import { getMrpSettings } from "@/lib/mrp";
import { getEdiSettings } from "@/lib/edi/settings";
import { getControllingSettings } from "@/lib/controlling";
import { cleanDisabledModules, SWITCHABLE_MODULES, type ModuleStore } from "@/lib/company-modules";
import { setModuleEnabled } from "@/lib/actions/modules";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";

export const metadata = { title: "Modules" };

export default async function ModulesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const [company, returns, mrp, edi, controlling] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { disabledModules: true } }),
    getReturnPolicy(session.companyId),
    getMrpSettings(session.companyId),
    getEdiSettings(session.companyId),
    getControllingSettings(session.companyId),
  ]);
  const disabled = cleanDisabledModules(company.disabledModules);
  // The older per module switches still count: off there means off here.
  const ownSwitch: Record<ModuleStore, boolean> = {
    company: true,
    returns: returns.enabled,
    mrp: mrp.enabled,
    edi: edi ? edi.enabled : true,
    controlling: controlling.enabled,
  };
  const modules = SWITCHABLE_MODULES.map((m) => ({ ...m, on: !disabled.includes(m.key) && ownSwitch[m.store] }));
  const sections = [...new Set(modules.map((m) => m.section))];
  const savedLabel = modules.find((m) => m.key === saved);

  return (
    <div className="mx-auto max-w-4xl">
      <SettingsTabs role={session.role} current="/dashboard/settings/modules" />
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Modules</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Switch off what your business doesn&apos;t use. A switched off module leaves the menu and search for everyone, and its pages close. Nothing is deleted: switch it back on and everything is where you left it.
      </p>

      <div className="mt-4 space-y-3">
        <ErrorBanner code={error} />
        {savedLabel && (
          <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            {savedLabel.label} is now {savedLabel.on ? "on" : "off"}.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section} aria-labelledby={`sec-${section}`}>
            <h2 id={`sec-${section}`} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section}
            </h2>
            <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.09] glass light:divide-slate-200 light:border-white/80">
              {modules
                .filter((m) => m.section === section)
                .map((m) => (
                  <li key={m.key} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", m.on ? "text-slate-50 light:text-slate-900" : "text-slate-400 light:text-slate-500")}>{m.label}</p>
                      <p className="text-xs text-slate-400 light:text-slate-500">{m.description}</p>
                    </div>
                    <form action={setModuleEnabled}>
                      <input type="hidden" name="module" value={m.key} />
                      {!m.on && <input type="hidden" name="enabled" value="on" />}
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={m.on}
                        aria-label={`${m.label}: ${m.on ? "on, switch off" : "off, switch on"}`}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                          m.on ? "bg-blue-600" : "bg-white/15 light:bg-slate-300",
                        )}
                      >
                        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", m.on ? "translate-x-5" : "translate-x-0.5")} />
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400 light:text-slate-500">
        Dashboard, CRM, Sales, Invoicing, Inventory and these settings are always on. Transfers appear by themselves once you have a second branch.
      </p>
    </div>
  );
}
