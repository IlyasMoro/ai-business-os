"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { EmployeeSchema, type EmployeeFormState } from "@/lib/validation/hr";

/** A cost center id from the form, only if it belongs to this company. */
async function ownCostCenter(companyId: string, value: FormDataEntryValue | null): Promise<string | null | "invalid"> {
  if (typeof value !== "string" || !value) return null;
  const cc = await db.costCenter.findUnique({ where: { id: value, companyId }, select: { id: true } });
  return cc ? cc.id : "invalid";
}

export async function createEmployee(
  _state: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = EmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    position: formData.get("position"),
    department: formData.get("department"),
    salary: formData.get("salary"),
    hireDate: formData.get("hireDate"),
    status: formData.get("status"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, hireDate, ...rest } = validated.data;
  const parsedHireDate = new Date(hireDate);
  if (Number.isNaN(parsedHireDate.getTime())) {
    return { errors: { hireDate: ["Enter a valid date."] } };
  }

  const costCenterId = await ownCostCenter(session.companyId, formData.get("costCenterId"));
  if (costCenterId === "invalid") return { message: "Select a valid cost center." };

  const employee = await db.employee.create({
    data: {
      ...rest,
      costCenterId,
      email: email || undefined,
      hireDate: parsedHireDate,
      companyId: session.companyId,
    },
  });

  await logAudit(session.companyId, session.userId, "employee.created", "Employee", employee.id, {
    status: rest.status,
  });

  revalidatePath("/dashboard/hr");
  redirect(`/dashboard/hr/${employee.id}`);
}

export async function updateEmployee(
  employeeId: string,
  _state: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = EmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    position: formData.get("position"),
    department: formData.get("department"),
    salary: formData.get("salary"),
    hireDate: formData.get("hireDate"),
    status: formData.get("status"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, hireDate, ...rest } = validated.data;
  const parsedHireDate = new Date(hireDate);
  if (Number.isNaN(parsedHireDate.getTime())) {
    return { errors: { hireDate: ["Enter a valid date."] } };
  }

  const costCenterId = await ownCostCenter(session.companyId, formData.get("costCenterId"));
  if (costCenterId === "invalid") return { message: "Select a valid cost center." };

  await db.employee.update({
    where: { id: employeeId, companyId: session.companyId },
    data: { ...rest, email: email || null, hireDate: parsedHireDate, costCenterId },
  });

  await logAudit(session.companyId, session.userId, "employee.updated", "Employee", employeeId, {
    status: rest.status,
    salary: rest.salary,
  });

  revalidatePath("/dashboard/hr");
  revalidatePath(`/dashboard/hr/${employeeId}`);
  redirect(`/dashboard/hr/${employeeId}`);
}

export async function deleteEmployee(employeeId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const inUse = await db.payrollItem.findFirst({
    where: { employeeId, employee: { companyId: session.companyId } },
    select: { id: true },
  });
  if (inUse) {
    redirect(`/dashboard/hr/${employeeId}?error=in-use`);
  }

  await db.employee.delete({
    where: { id: employeeId, companyId: session.companyId },
  });

  await logAudit(session.companyId, session.userId, "employee.deleted", "Employee", employeeId);

  revalidatePath("/dashboard/hr");
  redirect("/dashboard/hr");
}
