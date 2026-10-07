import Link from "next/link";
import { Plus, ShieldCheck, Users } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { listCompanyRoles } from "@/lib/company-roles";
import { deleteCompanyRole } from "@/lib/actions/roles";
import { MODULES } from "@/lib/role-access";
import { BackButton } from "@/components/ui-dark/back-button";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { buttonStyles } from "@/components/ui-dark/button";
import { ErrorBanner } from "@/components/ui/error-banner";

export const metadata = { title: "Roles" };

/** Owner only: the company's roles, what each can open, and who has it. */
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const session = await requireRole(["OWNER"]);
  const roles = await listCompanyRoles(session.companyId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <BackButton href="/dashboard/team" label="Team" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Roles</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
            What each person can open. Give a role on the Team page; changes apply on their next click. Owners always see everything, and only owners
            manage roles.
          </p>
        </div>
        <Link href="/dashboard/team/roles/new" className={buttonStyles("primary", "md", "shrink-0")}>
          <Plus className="h-4 w-4" />
          New role
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">Role saved.</p>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {roles.map((role) => {
          const full = MODULES.filter((m) => role.access[m.key] === "full");
          const view = MODULES.filter((m) => role.access[m.key] === "view");
          const holders = role._count.users + role._count.invites;
          return (
            <article key={role.id} className="flex flex-col rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-50 light:text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-blue-400 light:text-blue-600" />
                    {role.name}
                    <Badge tone={role.baseRole === "ADMIN" ? "blue" : "slate"}>{role.baseRole === "ADMIN" ? "Manager level" : "Staff level"}</Badge>
                    {role.preset && <Badge tone="purple">Ready made</Badge>}
                  </h2>
                  {role.description && <p className="mt-1 text-sm text-slate-400 light:text-slate-500">{role.description}</p>}
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400 light:text-slate-500" title="Members and open invites">
                  <Users className="h-3.5 w-3.5" />
                  {holders}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Full access</p>
                <p className="text-slate-200 light:text-slate-700">{full.length ? full.map((m) => m.label).join(", ") : "None"}</p>
                {view.length > 0 && (
                  <>
                    <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">View only</p>
                    <p className="text-slate-300 light:text-slate-600">{view.map((m) => m.label).join(", ")}</p>
                  </>
                )}
              </div>

              <div className="mt-auto flex items-center gap-2 pt-4">
                <Link href={`/dashboard/team/roles/${role.id}`} className={buttonStyles("secondary", "sm")}>
                  Edit
                </Link>
                {!role.preset && (
                  <DeleteButton
                    action={deleteCompanyRole.bind(null, role.id)}
                    confirmMessage={holders > 0 ? `${role.name} is still given to ${holders} people or invites. Give them another role first.` : `Delete the ${role.name} role?`}
                    label="Delete"
                  />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
