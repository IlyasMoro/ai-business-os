import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const verifySession = cache(async () => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

export const getOptionalSession = cache(async () => {
  return getSessionPayload();
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      company: { select: { id: true, name: true, industry: true } },
    },
  });
  if (!user) {
    redirect("/login");
  }
  return user;
});
