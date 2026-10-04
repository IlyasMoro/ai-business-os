import { describe, it, expect } from "vitest";
import { campaignStats, formatRoi, totalStats, type CampaignLeadInput } from "@/lib/campaign-stats";

const lead = (over: Partial<CampaignLeadInput> = {}): CampaignLeadInput => ({ status: "LEAD", deals: [], paidInvoices: [], ...over });

describe("campaignStats", () => {
  it("follows leads to won deals, open pipeline and paid revenue", () => {
    const s = campaignStats({
      budget: 1000,
      spent: 400,
      startDate: new Date("2026-09-01"),
      leads: [
        lead({ deals: [{ stage: "WON", value: 900 }, { stage: "PROPOSAL", value: 300 }], paidInvoices: [{ totalAmount: 1000, issueDate: new Date("2026-09-15") }] }),
        lead({ deals: [{ stage: "LOST", value: 500 }] }),
        lead({ status: "ACTIVE" }),
        lead(),
      ],
    });
    expect(s).toMatchObject({
      leads: 4,
      converted: 2,
      conversionPct: 50,
      wonDeals: 1,
      wonValue: 900,
      openPipeline: 300,
      revenue: 1000,
      budgetLeft: 600,
      costPerLead: 100,
      costPerCustomer: 200,
      roiPct: 150,
    });
  });

  it("doesn't credit invoices from before the campaign started", () => {
    const s = campaignStats({
      budget: 0,
      spent: 100,
      startDate: new Date("2026-09-01"),
      leads: [lead({ paidInvoices: [{ totalAmount: 500, issueDate: new Date("2026-08-20") }, { totalAmount: 50, issueDate: new Date("2026-09-01") }] })],
    });
    expect(s.revenue).toBe(50);
    expect(s.roiPct).toBe(-50);
  });

  it("counts every paid invoice when there is no start date", () => {
    const s = campaignStats({ budget: 0, spent: 0, startDate: null, leads: [lead({ paidInvoices: [{ totalAmount: 75, issueDate: new Date("2020-01-01") }] })] });
    expect(s.revenue).toBe(75);
    expect(s.converted).toBe(1);
  });

  it("leaves costs and return empty until spend is recorded", () => {
    const s = campaignStats({ budget: 500, spent: 0, startDate: null, leads: [lead()] });
    expect(s.costPerLead).toBeNull();
    expect(s.costPerCustomer).toBeNull();
    expect(s.roiPct).toBeNull();
    expect(s.budgetLeft).toBe(500);
  });

  it("shows overspend as a negative budget left and handles no leads", () => {
    const s = campaignStats({ budget: 100, spent: 150, startDate: null, leads: [] });
    expect(s.budgetLeft).toBe(-50);
    expect(s.conversionPct).toBeNull();
    expect(s.costPerLead).toBeNull();
    expect(s.roiPct).toBe(-100);
  });
});

describe("totalStats", () => {
  it("adds campaigns and recomputes the ratios from the sums", () => {
    const a = campaignStats({ budget: 100, spent: 100, startDate: null, leads: [lead({ status: "ACTIVE", paidInvoices: [{ totalAmount: 300, issueDate: new Date() }] })] });
    const b = campaignStats({ budget: 200, spent: 100, startDate: null, leads: [lead(), lead()] });
    const t = totalStats([a, b]);
    expect(t).toMatchObject({ leads: 3, converted: 1, spent: 200, revenue: 300, budget: 300, budgetLeft: 100, roiPct: 50 });
    expect(t.costPerLead).toBeCloseTo(66.67);
  });
});

describe("formatRoi", () => {
  it("signs and rounds", () => {
    expect(formatRoi(150)).toBe("+150%");
    expect(formatRoi(-20.4)).toBe("-20%");
    expect(formatRoi(0)).toBe("0%");
    expect(formatRoi(null)).toBe("n/a");
  });
});
