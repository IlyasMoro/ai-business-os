"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  ProjectSchema,
  ProjectStatusValues,
  TaskSchema,
  TaskStatusValues,
  type ProjectFormState,
  type TaskFormState,
} from "@/lib/validation/projects";

function parseOptionalDate(value: string | undefined) {
  if (!value) return { ok: true as const, date: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { ok: false as const };
  return { ok: true as const, date: parsed };
}

export async function createProject(
  _state: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const session = await verifySession();

  const validated = ProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    customerId: formData.get("customerId"),
    dueDate: formData.get("dueDate"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, description, customerId, dueDate } = validated.data;

  const parsedDueDate = parseOptionalDate(dueDate);
  if (!parsedDueDate.ok) {
    return { errors: { dueDate: ["Enter a valid date."] } };
  }

  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId, companyId: session.companyId },
      select: { id: true },
    });
    if (!customer) {
      return { errors: { customerId: ["Select a valid customer."] } };
    }
  }

  const project = await db.project.create({
    data: {
      name,
      description: description || undefined,
      customerId: customerId || undefined,
      dueDate: parsedDueDate.date,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function updateProject(
  projectId: string,
  _state: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const session = await verifySession();

  const validated = ProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    customerId: formData.get("customerId"),
    dueDate: formData.get("dueDate"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, description, customerId, dueDate } = validated.data;

  const parsedDueDate = parseOptionalDate(dueDate);
  if (!parsedDueDate.ok) {
    return { errors: { dueDate: ["Enter a valid date."] } };
  }

  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId, companyId: session.companyId },
      select: { id: true },
    });
    if (!customer) {
      return { errors: { customerId: ["Select a valid customer."] } };
    }
  }

  await db.project.update({
    where: { id: projectId, companyId: session.companyId },
    data: {
      name,
      description: description || null,
      customerId: customerId || null,
      dueDate: parsedDueDate.date,
    },
  });

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/projects/${projectId}`);
}

export async function updateProjectStatus(projectId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !ProjectStatusValues.includes(status as (typeof ProjectStatusValues)[number])
  ) {
    return;
  }

  await db.project.update({
    where: { id: projectId, companyId: session.companyId },
    data: { status: status as (typeof ProjectStatusValues)[number] },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/projects");
}

export async function deleteProject(projectId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/projects?error=forbidden");
  }

  await db.project.delete({
    where: { id: projectId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}

export async function addTask(
  projectId: string,
  _state: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const session = await verifySession();

  const validated = TaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    dueDate: formData.get("dueDate"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const project = await db.project.findUnique({
    where: { id: projectId, companyId: session.companyId },
    select: { id: true },
  });
  if (!project) {
    return { message: "Project not found." };
  }

  const { title, description, assigneeId, dueDate } = validated.data;

  const parsedDueDate = parseOptionalDate(dueDate);
  if (!parsedDueDate.ok) {
    return { errors: { dueDate: ["Enter a valid date."] } };
  }

  if (assigneeId) {
    const employee = await db.employee.findUnique({
      where: { id: assigneeId, companyId: session.companyId },
      select: { id: true },
    });
    if (!employee) {
      return { errors: { assigneeId: ["Select a valid assignee."] } };
    }
  }

  await db.task.create({
    data: {
      projectId,
      title,
      description: description || undefined,
      assigneeId: assigneeId || undefined,
      dueDate: parsedDueDate.date,
    },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return undefined;
}

export async function updateTaskStatus(projectId: string, taskId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !TaskStatusValues.includes(status as (typeof TaskStatusValues)[number])
  ) {
    return;
  }

  await db.task.update({
    where: { id: taskId, project: { companyId: session.companyId } },
    data: { status: status as (typeof TaskStatusValues)[number] },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function removeTask(projectId: string, taskId: string) {
  const session = await verifySession();

  await db.task.delete({
    where: { id: taskId, project: { companyId: session.companyId } },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}
