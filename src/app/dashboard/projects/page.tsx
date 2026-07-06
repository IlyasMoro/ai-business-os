import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  ACTIVE: "blue",
  COMPLETED: "green",
  ON_HOLD: "yellow",
} as const;

export default async function ProjectsPage() {
  const session = await verifySession();

  const projects = await db.project.findMany({
    where: { companyId: session.companyId },
    include: { customer: { select: { name: true } }, _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/projects/new">
          <Plus className="h-4 w-4" />
          New project
        </LinkButton>
      </div>

      <Card className="mt-6">
        {projects.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No projects yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Tasks</th>
                <th className="px-5 py-3 font-medium">Due date</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{project.customer?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[project.status]}>{project.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{project._count.tasks}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {project.dueDate ? project.dueDate.toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
