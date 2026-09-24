export type MrpSettingsValues = {
  enabled: boolean;
  includePendingOrders: boolean;
  useSafetyStock: boolean;
  allowNegativeStock: boolean;
};

/** Used by any company that hasn't saved its own planning settings yet. */
export const DEFAULT_MRP_SETTINGS: MrpSettingsValues = {
  enabled: true,
  includePendingOrders: false,
  useSafetyStock: true,
  allowNegativeStock: false,
};

/**
 * Starting points for common kinds of business. Applying one just fills in
 * the settings; every value can still be edited afterwards.
 */
export const MRP_PRESETS = {
  makeToStock: {
    label: "Make to stock",
    description: "Keep safety stock on the shelf and build to replace it.",
    values: { enabled: true, includePendingOrders: false, useSafetyStock: true, allowNegativeStock: false },
  },
  makeToOrder: {
    label: "Make to order",
    description: "Only build what customers have ordered, including pending orders.",
    values: { enabled: true, includePendingOrders: true, useSafetyStock: false, allowNegativeStock: false },
  },
  distribution: {
    label: "Wholesale and retail",
    description: "Buy only. Plan purchases from orders and reorder levels.",
    values: { enabled: true, includePendingOrders: true, useSafetyStock: true, allowNegativeStock: false },
  },
  jobShop: {
    label: "Job shop",
    description: "Custom work where paperwork lags the floor. Allows short completions.",
    values: { enabled: true, includePendingOrders: true, useSafetyStock: false, allowNegativeStock: true },
  },
  services: {
    label: "Services only",
    description: "Turns planning off and hides the Planning page.",
    values: { ...DEFAULT_MRP_SETTINGS, enabled: false },
  },
} satisfies Record<string, { label: string; description: string; values: MrpSettingsValues }>;

export type MrpPreset = keyof typeof MRP_PRESETS;

export function isMrpPreset(value: unknown): value is MrpPreset {
  return typeof value === "string" && Object.hasOwn(MRP_PRESETS, value);
}
