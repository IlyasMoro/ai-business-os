export type ControllingValues = {
  enabled: boolean;
  fiscalYearStartMonth: number;
  overBudgetAction: "NONE" | "WARN" | "BLOCK";
  tolerancePercent: number;
  includePayroll: boolean;
  requireCostCenter: boolean;
};

/** Used by any company that hasn't saved its own Controlling settings yet. */
export const DEFAULT_CONTROLLING: ControllingValues = {
  enabled: true,
  fiscalYearStartMonth: 1,
  overBudgetAction: "WARN",
  tolerancePercent: 0,
  includePayroll: true,
  requireCostCenter: false,
};

/**
 * Starting points for different ways of running budgets. Applying one
 * keeps the fiscal year start, since that's a fact about the business.
 */
export const CONTROLLING_PRESETS = {
  flexible: {
    label: "Flexible",
    description: "Warn when a budget is 10% over. Cost centers optional.",
    values: { overBudgetAction: "WARN", tolerancePercent: 10, includePayroll: true, requireCostCenter: false, enabled: true },
  },
  strict: {
    label: "Strict budgets",
    description: "Block any expense over budget. Every expense needs a cost center.",
    values: { overBudgetAction: "BLOCK", tolerancePercent: 0, includePayroll: true, requireCostCenter: true, enabled: true },
  },
  grantFunded: {
    label: "Grant funded",
    description: "Block over budget with a 5% margin, every cost assigned, for funder reports.",
    values: { overBudgetAction: "BLOCK", tolerancePercent: 5, includePayroll: true, requireCostCenter: true, enabled: true },
  },
  trackingOnly: {
    label: "Tracking only",
    description: "Report plan vs actual but never warn or block.",
    values: { overBudgetAction: "NONE", tolerancePercent: 0, includePayroll: true, requireCostCenter: false, enabled: true },
  },
  off: {
    label: "Turn off",
    description: "Hides Controlling for businesses that don't budget by department.",
    values: { overBudgetAction: "WARN", tolerancePercent: 0, includePayroll: true, requireCostCenter: false, enabled: false },
  },
} satisfies Record<string, { label: string; description: string; values: Omit<ControllingValues, "fiscalYearStartMonth"> }>;

export type ControllingPreset = keyof typeof CONTROLLING_PRESETS;

export function isControllingPreset(value: unknown): value is ControllingPreset {
  return typeof value === "string" && Object.hasOwn(CONTROLLING_PRESETS, value);
}
