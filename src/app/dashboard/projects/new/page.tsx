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
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-white">New project</h1>
      <div className="mt-6">
        <ProjectForm action={createProject} customers={customers} submitLabel="Create project" />
      </div>
    </div>
  );
}
