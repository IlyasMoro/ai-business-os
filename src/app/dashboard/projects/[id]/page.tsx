import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { TaskForm } from "@/components/projects/task-form";
import { TaskStatusForm } from "@/components/projects/task-status-form";
import { ProjectStatusForm } from "@/components/projects/project-status-form";
import { DocumentsSection } from "@/components/documents/documents-section";
import { deleteProject, removeTask } from "@/lib/actions/projects";
import { Pencil } from "lucide-react";

const statusTone = {
  ACTIVE: "blue",
  COMPLETED: "green",
  ON_HOLD: "yellow",
} as const;

const priorityTone = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "red",
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
      tasks: { include: { assignee: true, _count: { select: { comments: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  const transactionTotals = await db.transaction.groupBy({
    by: ["type"],
    where: { projectId: project.id },
    _sum: { amount: true },
  });
  const projectRevenue = transactionTotals.find((t) => t.type === "INCOME")?._sum.amount ?? 0;
  const projectCosts = transactionTotals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0;
  const hasProjectFinancials = transactionTotals.length > 0;

  const employees = await db.employee.findMany({
    where: { companyId: session.companyId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const documents = await db.document.findMany({
    where: { companyId: session.companyId, entityType: "PROJECT", entityId: project.id },
    select: { id: true, filename: true, size: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{project.name}</h1>
              <Badge tone={statusTone[project.status]}>{project.status}</Badge>
            </div>
            {project.customer && (
              <p className="mt-1 text-slate-400 light:text-slate-500">For {project.customer.name}</p>
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
          <p className="mt-4 text-sm text-slate-400 light:text-slate-500">{project.description}</p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {project.tasks.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {project.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/projects/${project.id}/tasks/${task.id}`}
                          className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                        >
                          {task.title}
                        </Link>
                        <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
                      </div>
                      <p className="text-slate-500">
                        {task.assignee ? task.assignee.name : "Unassigned"}
                        {task.dueDate ? ` · Due ${task.dueDate.toLocaleDateString()}` : ""}
                        {task._count.comments > 0
                          ? ` · ${task._count.comments} comment${task._count.comments === 1 ? "" : "s"}`
                          : ""}
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

        {hasProjectFinancials && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Profitability</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Revenue</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-400">
                  ${projectRevenue.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Costs</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-red-400">
                  ${projectCosts.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Margin</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">
                  ${(projectRevenue - projectCosts).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <DocumentsSection
          entityType="PROJECT"
          entityId={project.id}
          redirectPath={`/dashboard/projects/${project.id}`}
          documents={documents}
        />

        <p className="mt-6">
          <Link href="/dashboard/projects" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to projects
          </Link>
        </p>
      </div>
    </div>
  );
}
