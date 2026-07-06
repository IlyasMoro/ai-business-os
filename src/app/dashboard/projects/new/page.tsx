import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject } from "@/lib/actions/projects";

export default async function NewProjectPage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New project</h1>
      <div className="mt-6">
        <ProjectForm action={createProject} customers={customers} submitLabel="Create project" />
      </div>
    </div>
  );
}
