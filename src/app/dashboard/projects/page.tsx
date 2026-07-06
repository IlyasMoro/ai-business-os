import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SearchForm } from "@/components/ui/search-form";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus } from "lucide-react";

const statusTone = {
  ACTIVE: "blue",
  COMPLETED: "green",
  ON_HOLD: "yellow",
} as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.ProjectWhereInput = {
    companyId: session.companyId,
    ...(q ? { name: { contains: q } } : {}),
  };

  const [projects, totalCount] = await Promise.all([
    db.project.findMany({
      where,
      include: { customer: { select: { name: true } }, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.project.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} project{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm placeholder="Search projects..." defaultValue={q} />
          <LinkButton href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New project
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6">
        {projects.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No projects match your search."
              : "No projects yet. Create your first one to get started."}
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
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/projects" query={{ q }} />
      </Card>
    </div>
  );
}
