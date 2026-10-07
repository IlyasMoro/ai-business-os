import { requireRole } from "@/lib/dal";
import { createCompanyRole } from "@/lib/actions/roles";
import { BackButton } from "@/components/ui-dark/back-button";
import { RoleForm } from "@/components/team/role-form";

export const metadata = { title: "New role" };

export default async function NewRolePage() {
  await requireRole(["OWNER"]);
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <BackButton href="/dashboard/team/roles" label="Roles" />
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New role</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Name it after the job, then tick what that person needs.</p>
      <div className="mt-6 rounded-2xl border border-white/[0.09] p-5 glass sm:p-6 light:border-white/80">
        <RoleForm action={createCompanyRole} submitLabel="Create role" />
      </div>
    </div>
  );
}
