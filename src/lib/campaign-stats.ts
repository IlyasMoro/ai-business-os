/* Campaign results shared by the campaign pages, Reports, the CSV export and
   the AI Copilot. No database access here (see lib/campaign-data.ts).

   A campaign's leads are the customers attributed to it. Their results:
   - won deals and won value, from the CRM pipeline;
   - revenue, from PAID invoices issued on or after the campaign's start
     date (all paid invoices when it has no start date), so business from
     before the campaign isn't credited to it;
   - return on spend, (revenue - spent) / spent, only once spend is recorded. */

import { isOpenStage, type DealStage } from "@/lib/crm-pipeline";

export type CampaignLeadInput = {
  status: "LEAD" | "ACTIVE" | "INACTIVE";
  deals: { stage: DealStage; value: number }[];
  /** Paid invoices only. */
  paidInvoices: { totalAmount: number; issueDate: Date }[];
};

export type CampaignInput = {
  budget: number;
  spent: number;
  startDate: Date | null;
  leads: CampaignLeadInput[];
};

export type CampaignStats = {
  leads: number;
  /** Leads that became paying or active customers, or won a deal. */
  converted: number;
  /** converted / leads, 0 to 100; null with no leads. */
  conversionPct: number | null;
  wonDeals: number;
  wonValue: number;
  /** Value of deals still open. */
  openPipeline: number;
  revenue: number;
  budget: number;
  spent: number;
  /** budget - spent; negative when over budget. */
  budgetLeft: number;
  costPerLead: number | null;
  costPerCustomer: number | null;
  /** (revenue - spent) / spent as a percentage; null until spend is recorded. */
  roiPct: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function campaignStats(campaign: CampaignInput): CampaignStats {
  const from = campaign.startDate?.getTime() ?? -Infinity;
  let converted = 0;
  let wonDeals = 0;
  let wonValue = 0;
  let openPipeline = 0;
  let revenue = 0;

  for (const lead of campaign.leads) {
    const won = lead.deals.filter((d) => d.stage === "WON");
    const paid = lead.paidInvoices.filter((i) => i.issueDate.getTime() >= from);
    wonDeals += won.length;
    wonValue += won.reduce((s, d) => s + d.value, 0);
    openPipeline += lead.deals.filter((d) => isOpenStage(d.stage)).reduce((s, d) => s + d.value, 0);
    revenue += paid.reduce((s, i) => s + i.totalAmount, 0);
    if (lead.status === "ACTIVE" || won.length > 0 || paid.length > 0) converted++;
  }

  const leads = campaign.leads.length;
  const spent = campaign.spent;
  return {
    leads,
    converted,
    conversionPct: leads > 0 ? round2((converted / leads) * 100) : null,
    wonDeals,
    wonValue: round2(wonValue),
    openPipeline: round2(openPipeline),
    revenue: round2(revenue),
    budget: campaign.budget,
    spent,
    budgetLeft: round2(campaign.budget - spent),
    costPerLead: spent > 0 && leads > 0 ? round2(spent / leads) : null,
    costPerCustomer: spent > 0 && converted > 0 ? round2(spent / converted) : null,
    roiPct: spent > 0 ? round2(((revenue - spent) / spent) * 100) : null,
  };
}

/** Several campaigns added together, for the Reports total row. */
export function totalStats(all: CampaignStats[]): CampaignStats {
  const sum = (pick: (s: CampaignStats) => number) => round2(all.reduce((t, s) => t + pick(s), 0));
  const leads = sum((s) => s.leads);
  const converted = sum((s) => s.converted);
  const spent = sum((s) => s.spent);
  const revenue = sum((s) => s.revenue);
  const budget = sum((s) => s.budget);
  return {
    leads,
    converted,
    conversionPct: leads > 0 ? round2((converted / leads) * 100) : null,
    wonDeals: sum((s) => s.wonDeals),
    wonValue: sum((s) => s.wonValue),
    openPipeline: sum((s) => s.openPipeline),
    revenue,
    budget,
    spent,
    budgetLeft: round2(budget - spent),
    costPerLead: spent > 0 && leads > 0 ? round2(spent / leads) : null,
    costPerCustomer: spent > 0 && converted > 0 ? round2(spent / converted) : null,
    roiPct: spent > 0 ? round2(((revenue - spent) / spent) * 100) : null,
  };
}

/** "+150%", "-20%", or "n/a" before spend is recorded. */
export function formatRoi(roiPct: number | null): string {
  if (roiPct === null) return "n/a";
  const whole = Math.round(roiPct);
  return `${whole > 0 ? "+" : ""}${whole}%`;
}
