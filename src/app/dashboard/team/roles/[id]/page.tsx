import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { updateCompanyRole } from "@/lib/actions/roles";
import { cleanAccess } from "@/lib/role-access";
import { BackButton } from "@/components/ui-dark/back-button";
import { RoleForm } from "@/components/team/role-form";

export const metadata = { title: "Edit role" };

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole(["OWNER"]);
  const role = await db.companyRole.findUnique({
    where: { id, companyId: session.companyId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) notFound();
  const baseRole = role.baseRole === "ADMIN" ? "ADMIN" : "EMPLOYEE";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <BackButton href="/dashboard/team/roles" label="Roles" />
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{role.name}</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        {role._count.users === 0
          ? "Nobody has this role yet."
          : `${role._count.users} ${role._count.users === 1 ? "person has" : "people have"} this role. Changes apply on their next click.`}
      </p>
      <div className="mt-6 rounded-2xl border border-white/[0.09] p-5 glass sm:p-6 light:border-white/80">
        <RoleForm
          action={updateCompanyRole.bind(null, role.id)}
          initial={{ name: role.name, description: role.description, baseRole, access: cleanAccess(role.access, baseRole) }}
          submitLabel="Save role"
        />
      </div>
    </div>
  );
}
