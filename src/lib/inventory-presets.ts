/** Starting points for picking and expiry rules; every value stays editable. */
export const INVENTORY_PRESETS = {
  food: { label: "Food and pharmacy", description: "Ship what expires first, never ship expired stock, warn 30 days ahead.", values: { pickingRule: "FEFO", blockExpired: true, expiryWarningDays: 30 } },
  general: { label: "General goods", description: "Oldest stock first. Expiry isn't a concern.", values: { pickingRule: "FIFO", blockExpired: false, expiryWarningDays: 0 } },
  chemicals: { label: "Chemicals and parts", description: "Oldest stock first, block expired, warn 90 days ahead.", values: { pickingRule: "FIFO", blockExpired: true, expiryWarningDays: 90 } },
} as const;

export type InventoryPreset = keyof typeof INVENTORY_PRESETS;

export function isInventoryPreset(value: unknown): value is InventoryPreset {
  return typeof value === "string" && Object.hasOwn(INVENTORY_PRESETS, value);
}
