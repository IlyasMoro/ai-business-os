import { describe, expect, it } from "vitest";
import { DEAL_STAGES, followUpBucket, isOpenStage, pipelineSummary, positionBetween } from "./crm-pipeline";

describe("crm pipeline", () => {
  it("raises the default chance of winning stage by stage, with won at 100 and lost at 0", () => {
    const open = DEAL_STAGES.filter((s) => s.open);
    for (let i = 1; i < open.length; i++) expect(open[i].probability).toBeGreaterThan(open[i - 1].probability);
    expect(DEAL_STAGES.find((s) => s.id === "WON")!.probability).toBe(100);
    expect(DEAL_STAGES.find((s) => s.id === "LOST")!.probability).toBe(0);
    expect(isOpenStage("NEGOTIATION")).toBe(true);
    expect(isOpenStage("WON")).toBe(false);
  });

  it("totals the open pipeline, weights it by chance of winning and works out the win rate", () => {
    const summary = pipelineSummary([
      { value: 1000, stage: "NEW", probability: 10 },
      { value: 2000, stage: "PROPOSAL", probability: 50 },
      { value: 5000, stage: "WON", probability: 100 },
      { value: 3000, stage: "LOST", probability: 0 },
      { value: 4000, stage: "WON", probability: 100 },
    ]);
    expect(summary.openCount).toBe(2);
    expect(summary.openValue).toBe(3000);
    expect(summary.weightedValue).toBe(1100);
    expect(summary.byStage.WON).toEqual({ count: 2, value: 9000 });
    expect(summary.winRate).toBe(67);
    expect(pipelineSummary([{ value: 10, stage: "NEW", probability: 10 }]).winRate).toBeNull();
  });

  it("places a dropped card between its neighbours", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(2000, null)).toBe(3000);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("sorts follow-ups into overdue, today, upcoming and done", () => {
    const now = new Date(2026, 9, 4, 14, 0);
    expect(followUpBucket({ dueAt: new Date(2026, 9, 3, 18, 0), doneAt: null }, now)).toBe("overdue");
    expect(followUpBucket({ dueAt: new Date(2026, 9, 4, 9, 0), doneAt: null }, now)).toBe("today");
    expect(followUpBucket({ dueAt: new Date(2026, 9, 4, 23, 30), doneAt: null }, now)).toBe("today");
    expect(followUpBucket({ dueAt: new Date(2026, 9, 5, 8, 0), doneAt: null }, now)).toBe("upcoming");
    expect(followUpBucket({ dueAt: new Date(2026, 9, 1), doneAt: new Date(2026, 9, 2) }, now)).toBe("done");
  });
});
