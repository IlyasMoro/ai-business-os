import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject } from "@/lib/actions/projects";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewProjectPage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/projects" label="Back to projects" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New project</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ProjectForm action={createProject} customers={customers} submitLabel="Create project" />
        </div>
      </div>
    </div>
  );
}
