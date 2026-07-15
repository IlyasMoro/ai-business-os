"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { TransactionSchema, type TransactionFormState } from "@/lib/validation/accounting";
import { suggestTransactionCategory } from "@/lib/ai-categorize";

export async function suggestCategory(description: string, type: "INCOME" | "EXPENSE") {
  const session = await verifySession();

  if (!description.trim()) return null;

  const existing = await db.transaction.findMany({
    where: { companyId: session.companyId },
    select: { category: true },
    distinct: ["category"],
    take: 30,
  });

  try {
    return await suggestTransactionCategory(description, type, existing.map((t) => t.category));
  } catch {
    return null;
  }
}

export async function createTransaction(
  _state: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = TransactionSchema.safeParse({
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description"),
    projectId: formData.get("projectId"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { date, description, projectId, ...rest } = validated.data;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: ["Enter a valid date."] } };
  }

  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId, companyId: session.companyId },
      select: { id: true },
    });
    if (!project) {
      return { errors: { projectId: ["Select a valid project."] } };
    }
  }

  const transaction = await db.transaction.create({
    data: {
      ...rest,
      date: parsedDate,
      description: description || undefined,
      projectId: projectId || undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/accounting");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/accounting/${transaction.id}`);
}

export async function updateTransaction(
  transactionId: string,
  _state: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = TransactionSchema.safeParse({
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    description: formData.get("description"),
    projectId: formData.get("projectId"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { date, description, projectId, ...rest } = validated.data;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: ["Enter a valid date."] } };
  }

  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId, companyId: session.companyId },
      select: { id: true },
    });
    if (!project) {
      return { errors: { projectId: ["Select a valid project."] } };
    }
  }

  await db.transaction.update({
    where: { id: transactionId, companyId: session.companyId },
    data: { ...rest, date: parsedDate, description: description || null, projectId: projectId || null },
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath(`/dashboard/accounting/${transactionId}`);
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/accounting/${transactionId}`);
}

export async function deleteTransaction(transactionId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.transaction.delete({
    where: { id: transactionId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/accounting");
  redirect("/dashboard/accounting");
}
