import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { toCsv } from "@/lib/csv";
import { getCampaignsWithStats } from "@/lib/campaign-data";

export async function GET() {
  const session = await verifySession();

  const campaigns = await getCampaignsWithStats(session.companyId);

  const csv = toCsv(
    [
      "Name",
      "Channel",
      "Status",
      "Budget",
      "Spent",
      "Start Date",
      "End Date",
      "Leads",
      "Became Customers",
      "Deals Won",
      "Won Value",
      "Open Pipeline",
      "Revenue",
      "Cost Per Lead",
      "Return On Spend %",
    ],
    // Cost per lead and return stay empty (not 0) until spend is recorded.
    campaigns.map((c) => [
      c.name,
      c.channel,
      c.status,
      c.budget,
      c.spent,
      c.startDate,
      c.endDate,
      c.stats.leads,
      c.stats.converted,
      c.stats.wonDeals,
      c.stats.wonValue,
      c.stats.openPipeline,
      c.stats.revenue,
      c.stats.costPerLead,
      c.stats.roiPct,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaigns.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
