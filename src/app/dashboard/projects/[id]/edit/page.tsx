import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { updateProject } from "@/lib/actions/projects";
import type { ProjectFormState } from "@/lib/validation/projects";
import { toDateInputValue } from "@/lib/utils";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const project = await db.project.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!project) notFound();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const action = updateProject.bind(null, project.id) as (
    state: ProjectFormState,
    formData: FormData
  ) => Promise<ProjectFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={`/dashboard/projects/${id}`} label="Back to project" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit project</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ProjectForm
            action={action}
            customers={customers}
            defaultValues={{
              name: project.name,
              description: project.description,
              customerId: project.customerId,
              dueDate: project.dueDate ? toDateInputValue(project.dueDate) : "",
            }}
            submitLabel="Save changes"
          />
        </div>
      </div>
    </div>
  );
}
