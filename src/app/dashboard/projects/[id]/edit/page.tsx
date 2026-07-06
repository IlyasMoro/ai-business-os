import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { updateProject } from "@/lib/actions/projects";
import type { ProjectFormState } from "@/lib/validation/projects";
import { toDateInputValue } from "@/lib/utils";

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
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit project</h1>
      <div className="mt-6">
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
  );
}
