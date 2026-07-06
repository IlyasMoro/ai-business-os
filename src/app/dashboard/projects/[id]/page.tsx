import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { TaskForm } from "@/components/projects/task-form";
import { TaskStatusForm } from "@/components/projects/task-status-form";
import { ProjectStatusForm } from "@/components/projects/project-status-form";
import { deleteProject, removeTask } from "@/lib/actions/projects";
import { Pencil } from "lucide-react";

const statusTone = {
  ACTIVE: "blue",
  COMPLETED: "green",
  ON_HOLD: "yellow",
} as const;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const project = await db.project.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      tasks: { include: { assignee: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  const employees = await db.employee.findMany({
    where: { companyId: session.companyId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <Badge tone={statusTone[project.status]}>{project.status}</Badge>
          </div>
          {project.customer && (
            <p className="mt-1 text-slate-500">For {project.customer.name}</p>
          )}
          {project.dueDate && (
            <p className="mt-1 text-sm text-slate-500">
              Due {project.dueDate.toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ProjectStatusForm projectId={project.id} status={project.status} />
          <LinkButton href={`/dashboard/projects/${project.id}/edit`} variant="secondary" size="sm">
            <Pencil className="h-4 w-4" />
            Edit
          </LinkButton>
          <DeleteButton action={deleteProject.bind(null, project.id)} />
        </div>
      </div>

      {project.description && (
        <p className="mt-4 text-sm text-slate-600">{project.description}</p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {project.tasks.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100">
              {project.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{task.title}</p>
                    <p className="text-slate-500">
                      {task.assignee ? task.assignee.name : "Unassigned"}
                      {task.dueDate ? ` · Due ${task.dueDate.toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TaskStatusForm projectId={project.id} taskId={task.id} status={task.status} />
                    <DeleteButton
                      action={removeTask.bind(null, project.id, task.id)}
                      confirmMessage="Remove this task?"
                      label=""
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <TaskForm projectId={project.id} employees={employees} />
        </CardContent>
      </Card>

      <p className="mt-6">
        <Link href="/dashboard/projects" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to projects
        </Link>
      </p>
    </div>
  );
}
