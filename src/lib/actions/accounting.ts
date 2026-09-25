"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { TransactionSchema, type TransactionFormState } from "@/lib/validation/accounting";
import { suggestTransactionCategory } from "@/lib/ai-categorize";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkCostObject, getControllingSettings } from "@/lib/controlling";

/** Cost object and budget check shared by create and update. */
async function controlCost(
  companyId: string,
  data: { type: "INCOME" | "EXPENSE"; amount: number },
  date: Date,
  costObject: FormDataEntryValue | null,
  excludeTransactionId?: string
) {
  const settings = await getControllingSettings(companyId);
  const check = await checkCostObject({
    companyId,
    settings,
    type: data.type,
    costObject: typeof costObject === "string" && costObject ? costObject : undefined,
    amount: data.amount,
    date,
    excludeTransactionId,
  });
  if (!check.ok) return { error: check.message } as const;
  const a = check.availability;
  if (a?.result === "BLOCK") {
    return {
      error: `Blocked by budget control: this would put ${check.objectLabel} $${a.overBy.toFixed(2)} over budget ($${Math.max(0, a.available).toFixed(2)} still available).`,
    } as const;
  }
  return {
    costCenterId: check.costCenterId,
    internalOrderId: check.internalOrderId,
    warning: a?.result === "WARN" ? `?warning=budget&over=${a.overBy.toFixed(2)}` : "",
  } as const;
}

export async function suggestCategory(description: string, type: "INCOME" | "EXPENSE") {
  const session = await verifySession();

  if (!description.trim()) return null;

  const allowed = await checkRateLimit(`ai-suggest:${session.userId}`, {
    max: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return null;

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
    // The project picker only renders when projects exist, so the field can be absent.
    projectId: formData.get("projectId") || undefined,
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

  const control = await controlCost(session.companyId, rest, parsedDate, formData.get("costObject"));
  if ("error" in control) return { message: control.error };

  const transaction = await db.transaction.create({
    data: {
      ...rest,
      date: parsedDate,
      description: description || undefined,
      projectId: projectId || undefined,
      costCenterId: control.costCenterId,
      internalOrderId: control.internalOrderId,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/controlling");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/accounting/${transaction.id}${control.warning}`);
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
    // The project picker only renders when projects exist, so the field can be absent.
    projectId: formData.get("projectId") || undefined,
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

  const control = await controlCost(session.companyId, rest, parsedDate, formData.get("costObject"), transactionId);
  if ("error" in control) return { message: control.error };

  await db.transaction.update({
    where: { id: transactionId, companyId: session.companyId },
    data: {
      ...rest,
      date: parsedDate,
      description: description || null,
      projectId: projectId || null,
      costCenterId: control.costCenterId,
      internalOrderId: control.internalOrderId,
    },
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath(`/dashboard/accounting/${transactionId}`);
  revalidatePath("/dashboard/controlling");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/accounting/${transactionId}${control.warning}`);
}

export async function deleteTransaction(transactionId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.transaction.delete({
    where: { id: transactionId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/accounting");
  redirect("/dashboard/accounting");
}
