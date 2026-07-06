"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { EmployeeSchema, type EmployeeFormState } from "@/lib/validation/hr";

export async function createEmployee(
  _state: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const session = await verifySession();

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

  const employee = await db.employee.create({
    data: {
      ...rest,
      email: email || undefined,
      hireDate: parsedHireDate,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/hr");
  redirect(`/dashboard/hr/${employee.id}`);
}

export async function updateEmployee(
  employeeId: string,
  _state: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const session = await verifySession();

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

  await db.employee.update({
    where: { id: employeeId, companyId: session.companyId },
    data: { ...rest, email: email || null, hireDate: parsedHireDate },
  });

  revalidatePath("/dashboard/hr");
  revalidatePath(`/dashboard/hr/${employeeId}`);
  redirect(`/dashboard/hr/${employeeId}`);
}

export async function deleteEmployee(employeeId: string) {
  const session = await verifySession();

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

  revalidatePath("/dashboard/hr");
  redirect("/dashboard/hr");
}
