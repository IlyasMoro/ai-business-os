import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await verifySession();

  const campaigns = await db.campaign.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    select: { name: true, channel: true, status: true, budget: true, startDate: true, endDate: true },
  });

  const csv = toCsv(
    ["Name", "Channel", "Status", "Budget", "Start Date", "End Date"],
    campaigns.map((c) => [c.name, c.channel, c.status, c.budget, c.startDate, c.endDate])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campaigns.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
