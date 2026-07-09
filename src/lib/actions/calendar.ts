"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CalendarEventSchema } from "@/lib/validation/calendar";

export async function createCalendarEvent(formData: FormData) {
  const session = await verifySession();

  const validated = CalendarEventSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt") || undefined,
    description: formData.get("description"),
  });

  if (!validated.success) {
    redirect("/dashboard/calendar?error=invalid");
  }

  const { startAt, endAt, ...rest } = validated.data;
  const startDate = new Date(startAt);
  if (Number.isNaN(startDate.getTime())) {
    redirect("/dashboard/calendar?error=invalid");
  }

  await db.calendarEvent.create({
    data: {
      ...rest,
      startAt: startDate,
      endAt: endAt ? new Date(endAt) : undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/calendar");
  redirect("/dashboard/calendar");
}

export async function deleteCalendarEvent(eventId: string) {
  const session = await verifySession();

  await db.calendarEvent.delete({
    where: { id: eventId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/calendar");
}
