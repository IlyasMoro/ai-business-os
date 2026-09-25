export type ReturnPolicyValues = {
  enabled: boolean;
  windowDays: number;
  requireApproval: boolean;
  restockingFeePercent: number;
  restockDamaged: boolean;
  reasons: string;
};

/** Used by any company that hasn't saved its own return policy yet. */
export const DEFAULT_RETURN_POLICY: ReturnPolicyValues = {
  enabled: true,
  windowDays: 30,
  requireApproval: true,
  restockingFeePercent: 0,
  restockDamaged: false,
  reasons: ["Damaged on arrival", "Wrong item sent", "Not as described", "No longer needed"].join("\n"),
};

/**
 * Starting points for common kinds of business. Applying one just fills in
 * the policy; every value can still be edited afterwards.
 */
export const RETURN_POLICY_PRESETS = {
  retail: {
    label: "Retail store",
    description: "30 days, no approval step, no fee.",
    values: {
      enabled: true,
      windowDays: 30,
      requireApproval: false,
      restockingFeePercent: 0,
      restockDamaged: false,
      reasons: ["Wrong size or fit", "Changed my mind", "Damaged on arrival", "Not as described"].join("\n"),
    },
  },
  electronics: {
    label: "Electronics",
    description: "14 days, approval required, 15% restocking fee.",
    values: {
      enabled: true,
      windowDays: 14,
      requireApproval: true,
      restockingFeePercent: 15,
      restockDamaged: false,
      reasons: ["Faulty or not working", "Damaged on arrival", "Missing parts or accessories", "Unopened and unwanted"].join("\n"),
    },
  },
  wholesale: {
    label: "Wholesale and distribution",
    description: "7 days, approval required, 10% restocking fee.",
    values: {
      enabled: true,
      windowDays: 7,
      requireApproval: true,
      restockingFeePercent: 10,
      restockDamaged: false,
      reasons: ["Wrong item shipped", "Short or over shipment", "Damaged in transit", "Quality issue"].join("\n"),
    },
  },
  manufacturing: {
    label: "Manufacturing",
    description: "90 days for warranty claims, approval required.",
    values: {
      enabled: true,
      windowDays: 90,
      requireApproval: true,
      restockingFeePercent: 0,
      restockDamaged: false,
      reasons: ["Defective part", "Out of specification", "Wrong part number", "Warranty claim"].join("\n"),
    },
  },
  services: {
    label: "Services only",
    description: "Turns returns off and hides the Returns page.",
    values: { ...DEFAULT_RETURN_POLICY, enabled: false },
  },
} satisfies Record<string, { label: string; description: string; values: ReturnPolicyValues }>;

export type ReturnPolicyPreset = keyof typeof RETURN_POLICY_PRESETS;

export function isReturnPolicyPreset(value: unknown): value is ReturnPolicyPreset {
  return typeof value === "string" && Object.hasOwn(RETURN_POLICY_PRESETS, value);
}
