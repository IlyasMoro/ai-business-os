import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { TaskCommentForm } from "@/components/projects/task-comment-form";
import { deleteTaskComment } from "@/lib/actions/projects";
import { formatDistanceToNow } from "date-fns";
import { BackButton } from "@/components/ui-dark/back-button";

const priorityTone = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "red",
} as const;

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = await params;
  const session = await verifySession();

  const task = await db.task.findUnique({
    where: { id: taskId, project: { companyId: session.companyId, id: projectId } },
    include: {
      assignee: true,
      project: { select: { id: true, name: true } },
      comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!task) notFound();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href={`/dashboard/projects/${projectId}`} label={`Back to ${task.project.name}`} />
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{task.title}</h1>
          <StatusBadge status={task.priority} tone={priorityTone[task.priority]} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {task.project.name} · {task.assignee ? task.assignee.name : "Unassigned"}
          {task.dueDate ? ` · Due ${task.dueDate.toLocaleDateString()}` : ""}
        </p>

        {task.description && (
          <p className="mt-4 text-sm text-slate-400 light:text-slate-500">{task.description}</p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            {task.comments.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No comments yet.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {task.comments.map((comment) => (
                  <li key={comment.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="text-slate-50 light:text-slate-900">{comment.content}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {comment.author.name} · {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteTaskComment.bind(null, projectId, taskId, comment.id)}
                      confirmMessage="Delete this comment?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <TaskCommentForm projectId={projectId} taskId={taskId} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
