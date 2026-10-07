import { formatCurrency } from "@/lib/utils";
/* Branch performance: scores, ranks and compares branches, and writes the
   findings a manager should see first. Pure so it can be unit tested; the
   data comes from branch-performance-data.ts. User facing text here has no
   hyphens or dashes. */

/** One branch's figures for the period and the period before it. */
export type BranchFigures = {
  id: string;
  name: string;
  revenue: number;
  revenuePrev: number;
  expenses: number;
  /** Orders taken in the period (cancelled ones left out). */
  orders: number;
  /** Revenue per month, oldest first, for the trend line. */
  revenueByMonth: number[];
  /** Unpaid balance on overdue invoices. */
  overdue: number;
  /** Products at or below their reorder level. */
  lowStock: number;
  /** Stock at cost that expires within the warning window. */
  expiring: number;
  /** Stock on hand at cost. */
  stockValue: number;
  employees: number;
};

export type BranchStatus = "top" | "steady" | "attention";

export type ScoredBranch = BranchFigures & {
  net: number;
  /** Net as a share of revenue, or null with no revenue. */
  marginPct: number | null;
  /** Revenue change on the period before, or null when there was none. */
  growthPct: number | null;
  avgOrder: number | null;
  revenuePerEmployee: number | null;
  /** Share of the company's revenue in the period. */
  sharePct: number;
  /** 0 to 100, relative to the other branches. */
  score: number;
  rank: number;
  status: BranchStatus;
  /** Short reasons behind an "attention" status. */
  flags: string[];
};

export type Insight = { tone: "good" | "warn" | "bad" | "info"; branchId: string | null; text: string };

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);
const money = (n: number) => formatCurrency(n, { cents: false });
const whole = (n: number) => Math.round(Math.abs(n)).toString();

/** Where `value` sits between the lowest and highest of `all`, 0 to 1. */
function spread(value: number, all: number[]) {
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return hi === lo ? 0.5 : (value - lo) / (hi - lo);
}

/**
 * Scores every branch against the others: margin (35%), growth (30%), size
 * of revenue (15%), and how clean it runs (20%: overdue money, expiring
 * stock and empty shelves, each relative to its own revenue). Branches are
 * ranked by score; the best is "top", and a branch is "attention" when it
 * loses money, shrinks fast, or carries real overdue or expiring amounts.
 */
export function scoreBranches(rows: BranchFigures[]): ScoredBranch[] {
  if (rows.length === 0) return [];
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

  const base = rows.map((r) => {
    const net = r.revenue - r.expenses;
    return {
      ...r,
      net,
      marginPct: pct(net, r.revenue),
      growthPct: r.revenuePrev > 0 ? ((r.revenue - r.revenuePrev) / r.revenuePrev) * 100 : null,
      avgOrder: r.orders > 0 ? r.revenue / r.orders : null,
      revenuePerEmployee: r.employees > 0 ? r.revenue / r.employees : null,
      sharePct: pct(r.revenue, totalRevenue) ?? 0,
      // Problems as a share of the branch's own revenue, so a big branch
      // isn't punished just for being big.
      risk: r.revenue > 0 ? (r.overdue + r.expiring) / r.revenue + r.lowStock * 0.01 : r.lowStock * 0.01,
    };
  });

  const margins = base.map((b) => b.marginPct ?? 0);
  const growths = base.map((b) => b.growthPct ?? 0);
  const revenues = base.map((b) => b.revenue);
  const risks = base.map((b) => b.risk);

  const scored = base.map((b) => {
    const score =
      100 *
      (0.35 * spread(b.marginPct ?? 0, margins) +
        0.3 * spread(b.growthPct ?? 0, growths) +
        0.15 * spread(b.revenue, revenues) +
        0.2 * (1 - spread(b.risk, risks)));
    const flags: string[] = [];
    if (b.net < 0) flags.push("Losing money");
    if (b.growthPct !== null && b.growthPct <= -5) flags.push(`Revenue down ${whole(b.growthPct)}%`);
    if (b.revenue > 0 && b.overdue / b.revenue >= 0.05) flags.push(`${money(b.overdue)} overdue`);
    if (b.revenue > 0 && b.expiring / b.revenue >= 0.03) flags.push(`${money(b.expiring)} expiring soon`);
    if (b.lowStock >= 3) flags.push(`${b.lowStock} items low`);
    const { risk: _risk, ...rest } = b;
    void _risk;
    return { ...rest, score: Math.round(score), flags, rank: 0, status: "steady" as BranchStatus };
  });

  scored.sort((a, b) => b.score - a.score || b.revenue - a.revenue);
  scored.forEach((s, i) => {
    s.rank = i + 1;
    s.status = s.flags.length > 0 ? "attention" : i === 0 && rows.length > 1 ? "top" : "steady";
  });
  return scored;
}

/**
 * The few things a manager should read first, most important first: who
 * leads, who grows, who slips, where margin leaks, and what needs action
 * today (expiring stock, overdue money, empty shelves).
 */
export function branchInsights(branches: ScoredBranch[], expiringDays: number): Insight[] {
  if (branches.length === 0) return [];
  const out: Insight[] = [];
  const withRevenue = branches.filter((b) => b.revenue > 0);

  if (branches.length > 1 && withRevenue.length > 0) {
    const leader = [...withRevenue].sort((a, b) => b.revenue - a.revenue)[0];
    out.push({
      tone: "good",
      branchId: leader.id,
      text: `${leader.name} brings in the most: ${money(leader.revenue)}, ${whole(leader.sharePct)}% of all revenue.`,
    });
  }

  const growing = branches.filter((b) => b.growthPct !== null && b.growthPct >= 3).sort((a, b) => b.growthPct! - a.growthPct!);
  if (growing[0]) {
    out.push({ tone: "good", branchId: growing[0].id, text: `${growing[0].name} is growing fastest, up ${whole(growing[0].growthPct!)}% on the period before.` });
  }
  for (const b of branches.filter((b) => b.growthPct !== null && b.growthPct <= -5).sort((a, b) => a.growthPct! - b.growthPct!)) {
    out.push({ tone: "bad", branchId: b.id, text: `${b.name} is down ${whole(b.growthPct!)}% on the period before. Worth a visit to find out why.` });
  }

  const margined = withRevenue.filter((b) => b.marginPct !== null);
  if (margined.length > 1) {
    const avg = (margined.reduce((s, b) => s + b.net, 0) / margined.reduce((s, b) => s + b.revenue, 0)) * 100;
    const worst = [...margined].sort((a, b) => a.marginPct! - b.marginPct!)[0];
    const best = [...margined].sort((a, b) => b.marginPct! - a.marginPct!)[0];
    if (worst.net < 0) {
      out.push({ tone: "bad", branchId: worst.id, text: `${worst.name} is losing money: costs are ${money(-worst.net)} more than its revenue.` });
    } else if (avg - worst.marginPct! >= 3) {
      out.push({
        tone: "warn",
        branchId: worst.id,
        text: `${worst.name} keeps ${whole(worst.marginPct!)}% of its revenue as profit, ${whole(avg - worst.marginPct!)} points below the ${whole(avg)}% average. Check its buying prices and waste.`,
      });
    }
    if (best.id !== worst.id && best.marginPct! - avg >= 3) {
      out.push({ tone: "info", branchId: best.id, text: `${best.name} has the best margin at ${whole(best.marginPct!)}%. Its way of working is worth copying.` });
    }
  }

  // One line each for expiring stock and overdue money, biggest first.
  const listed = (items: ScoredBranch[], value: (b: ScoredBranch) => number) =>
    items.map((b) => `${b.name} ${money(value(b))}`).join(", ");
  const expiring = [...branches].filter((b) => b.expiring > 0).sort((a, b) => b.expiring - a.expiring);
  if (expiring.length === 1) {
    out.push({
      tone: "warn",
      branchId: expiring[0].id,
      text: `${expiring[0].name} has ${money(expiring[0].expiring)} of stock expiring in the next ${expiringDays} days. Move it to a busier branch or mark it down.`,
    });
  } else if (expiring.length > 1) {
    out.push({
      tone: "warn",
      branchId: null,
      text: `Stock expiring in the next ${expiringDays} days: ${listed(expiring, (b) => b.expiring)}. Move it to a busier branch or mark it down.`,
    });
  }
  const overdue = [...branches].filter((b) => b.overdue > 0).sort((a, b) => b.overdue - a.overdue);
  if (overdue.length === 1) {
    out.push({ tone: "warn", branchId: overdue[0].id, text: `${overdue[0].name} has ${money(overdue[0].overdue)} in overdue invoices to follow up.` });
  } else if (overdue.length > 1) {
    out.push({ tone: "warn", branchId: null, text: `Overdue invoices to follow up: ${listed(overdue, (b) => b.overdue)}.` });
  }
  const shortest = [...branches].filter((b) => b.lowStock > 0).sort((a, b) => b.lowStock - a.lowStock)[0];
  if (shortest) {
    out.push({
      tone: "warn",
      branchId: shortest.id,
      text: `${shortest.name} has ${shortest.lowStock} product${shortest.lowStock === 1 ? "" : "s"} at or below the reorder level.`,
    });
  }

  const staffed = withRevenue.filter((b) => b.revenuePerEmployee !== null);
  if (staffed.length > 1) {
    const sorted = [...staffed].sort((a, b) => b.revenuePerEmployee! - a.revenuePerEmployee!);
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    if (hi.revenuePerEmployee! > lo.revenuePerEmployee! * 1.3) {
      out.push({
        tone: "info",
        branchId: lo.id,
        text: `Each person at ${hi.name} brings in ${money(hi.revenuePerEmployee!)}, against ${money(lo.revenuePerEmployee!)} at ${lo.name}. Check staffing and opening hours at ${lo.name}.`,
      });
    }
  }

  if (out.length === 0) out.push({ tone: "info", branchId: null, text: "Nothing stands out: every branch is on track." });
  return out;
}
