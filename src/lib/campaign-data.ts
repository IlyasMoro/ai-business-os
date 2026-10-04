import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { campaignStats, type CampaignStats } from "@/lib/campaign-stats";

/* Loads campaigns with what their leads went on to do, and works out the
   results with lib/campaign-stats.ts. Campaigns, deals and leads have no
   branch, so this is company wide whatever the branch switcher says. */

const campaignSelect = {
  id: true,
  name: true,
  channel: true,
  status: true,
  budget: true,
  spent: true,
  startDate: true,
  endDate: true,
  leads: {
    select: {
      status: true,
      deals: { select: { stage: true, value: true } },
      invoices: { where: { status: "PAID" }, select: { totalAmount: true, issueDate: true } },
    },
  },
} satisfies Prisma.CampaignSelect;

type CampaignRow = Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>;

export type CampaignWithStats = Omit<CampaignRow, "leads"> & { stats: CampaignStats };

function withStats({ leads, ...campaign }: CampaignRow): CampaignWithStats {
  return {
    ...campaign,
    stats: campaignStats({
      budget: campaign.budget,
      spent: campaign.spent,
      startDate: campaign.startDate,
      leads: leads.map((l) => ({ status: l.status, deals: l.deals, paidInvoices: l.invoices })),
    }),
  };
}

export async function getCampaignsWithStats(companyId: string, where: Prisma.CampaignWhereInput = {}): Promise<CampaignWithStats[]> {
  const rows = await db.campaign.findMany({
    where: { ...where, companyId },
    select: campaignSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(withStats);
}

export async function getCampaignStats(companyId: string, campaignId: string): Promise<CampaignStats | null> {
  const row = await db.campaign.findFirst({ where: { id: campaignId, companyId }, select: campaignSelect });
  return row ? withStats(row).stats : null;
}
