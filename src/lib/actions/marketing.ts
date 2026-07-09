"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CampaignSchema, CampaignStatusValues } from "@/lib/validation/marketing";

export async function createCampaign(formData: FormData) {
  const session = await verifySession();

  const validated = CampaignSchema.safeParse({
    name: formData.get("name"),
    channel: formData.get("channel"),
    budget: formData.get("budget"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    notes: formData.get("notes"),
  });

  if (!validated.success) {
    redirect("/dashboard/marketing/new?error=invalid");
  }

  const { startDate, endDate, ...rest } = validated.data;

  const campaign = await db.campaign.create({
    data: {
      ...rest,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/marketing");
  redirect(`/dashboard/marketing/${campaign.id}`);
}

export async function updateCampaignStatus(campaignId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (typeof status !== "string" || !CampaignStatusValues.includes(status as (typeof CampaignStatusValues)[number])) {
    return;
  }

  await db.campaign.update({
    where: { id: campaignId, companyId: session.companyId },
    data: { status: status as (typeof CampaignStatusValues)[number] },
  });

  revalidatePath(`/dashboard/marketing/${campaignId}`);
  revalidatePath("/dashboard/marketing");
}

export async function deleteCampaign(campaignId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/marketing?error=forbidden");
  }

  await db.campaign.delete({
    where: { id: campaignId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/marketing");
  redirect("/dashboard/marketing");
}
