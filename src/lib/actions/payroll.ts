"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { computeNetPay, computePayrollRunTotal } from "@/lib/payroll-math";
import {
  PayrollRunSchema,
  PayrollItemSchema,
  PayrollRunStatusValues,
  type PayrollRunFormState,
  type PayrollItemFormState,
} from "@/lib/validation/payroll";

async function recomputePayrollRunTotal(payrollRunId: string) {
  const items = await db.payrollItem.findMany({
    where: { payrollRunId },
    select: { netPay: true },
  });
  const totalAmount = computePayrollRunTotal(items);
  await db.payrollRun.update({ where: { id: payrollRunId }, data: { totalAmount } });
}

export async function createPayrollRun(
  _state: PayrollRunFormState,
  formData: FormData
): Promise<PayrollRunFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = PayrollRunSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const payrollRun = await db.payrollRun.create({
    data: {
      periodStart: new Date(validated.data.periodStart),
      periodEnd: new Date(validated.data.periodEnd),
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/payroll");
  redirect(`/dashboard/payroll/${payrollRun.id}`);
}

export async function updatePayrollRunStatus(payrollRunId: string, formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !PayrollRunStatusValues.includes(status as (typeof PayrollRunStatusValues)[number])
  ) {
    return;
  }

  await db.payrollRun.update({
    where: { id: payrollRunId, companyId: session.companyId },
    data: {
      status: status as (typeof PayrollRunStatusValues)[number],
      processedAt: status === "DRAFT" ? null : new Date(),
    },
  });

  await logAudit(session.companyId, session.userId, "payroll_run.status_changed", "PayrollRun", payrollRunId, {
    status,
  });

  revalidatePath(`/dashboard/payroll/${payrollRunId}`);
  revalidatePath("/dashboard/payroll");
}

export async function deletePayrollRun(payrollRunId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.payrollRun.delete({
    where: { id: payrollRunId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/payroll");
  redirect("/dashboard/payroll");
}

export async function addPayrollItem(
  payrollRunId: string,
  _state: PayrollItemFormState,
  formData: FormData
): Promise<PayrollItemFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = PayrollItemSchema.safeParse({
    employeeId: formData.get("employeeId"),
    grossPay: formData.get("grossPay"),
    deductions: formData.get("deductions"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const payrollRun = await db.payrollRun.findUnique({
    where: { id: payrollRunId, companyId: session.companyId },
    select: { id: true },
  });
  if (!payrollRun) {
    return { message: "Payroll run not found." };
  }

  const employee = await db.employee.findUnique({
    where: { id: validated.data.employeeId, companyId: session.companyId },
    select: { id: true },
  });
  if (!employee) {
    return { errors: { employeeId: ["Select a valid employee."] } };
  }

  const { grossPay, deductions } = validated.data;
  if (deductions > grossPay) {
    return { errors: { deductions: ["Deductions cannot exceed gross pay."] } };
  }

  await db.payrollItem.create({
    data: {
      payrollRunId,
      employeeId: employee.id,
      grossPay,
      deductions,
      netPay: computeNetPay(grossPay, deductions),
    },
  });

  await recomputePayrollRunTotal(payrollRunId);

  revalidatePath(`/dashboard/payroll/${payrollRunId}`);
  return undefined;
}

export async function removePayrollItem(payrollRunId: string, itemId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.payrollItem.delete({
    where: { id: itemId, payrollRun: { companyId: session.companyId } },
  });

  await recomputePayrollRunTotal(payrollRunId);

  revalidatePath(`/dashboard/payroll/${payrollRunId}`);
}
