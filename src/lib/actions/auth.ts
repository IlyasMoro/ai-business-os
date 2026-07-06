"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import {
  LoginSchema,
  RegisterSchema,
  type LoginFormState,
  type RegisterFormState,
} from "@/lib/validation/auth";

export async function register(
  _state: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const validated = RegisterSchema.safeParse({
    companyName: formData.get("companyName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { companyName, name, email, password } = validated.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName },
    });
    return tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "OWNER",
        companyId: company.id,
      },
    });
  });

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  redirect("/dashboard");
}

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "Invalid email or password." };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return { message: "Invalid email or password." };
  }

  await createSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
