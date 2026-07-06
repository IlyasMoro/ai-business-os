"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { TransactionSchema, type TransactionFormState } from "@/lib/validation/accounting";

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
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { date, description, ...rest } = validated.data;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: ["Enter a valid date."] } };
  }

  const transaction = await db.transaction.create({
    data: {
      ...rest,
      date: parsedDate,
      description: description || undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/accounting");
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
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { date, description, ...rest } = validated.data;
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return { errors: { date: ["Enter a valid date."] } };
  }

  await db.transaction.update({
    where: { id: transactionId, companyId: session.companyId },
    data: { ...rest, date: parsedDate, description: description || null },
  });

  revalidatePath("/dashboard/accounting");
  revalidatePath(`/dashboard/accounting/${transactionId}`);
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
