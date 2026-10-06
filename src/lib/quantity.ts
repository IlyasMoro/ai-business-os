// Quantities for products counted by the piece (EACH) and products sold by
// weight or volume (KG, L). Every quantity column is a Float, so a butchery
// can hold 1.350 kg of mince; EACH products are still kept to whole numbers
// here, so a "2.5 chairs" order line is refused rather than stored.
//
// Floats add up with tiny errors (0.1 + 0.2 = 0.30000000000000004), so
// anything that writes a quantity rounds it with roundQty first, and any
// "is there enough stock" comparison uses hasEnough rather than >=.

export type Unit = "EACH" | "KG" | "L";

export const QTY_DECIMALS = 3;
const SCALE = 10 ** QTY_DECIMALS;
const EPSILON = 1 / (SCALE * 10);

export const UNIT_LABELS: Record<Unit, string> = {
  EACH: "Each",
  KG: "Kilogram (kg)",
  L: "Litre (L)",
};

/** True for units sold by weight or volume, where decimals are allowed. */
export function isWeighed(unit: Unit | null | undefined): boolean {
  return unit === "KG" || unit === "L";
}

/** A quantity rounded to the 3 decimals stored (whole numbers stay whole). */
export function roundQty(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

/** Whether `available` covers `needed`, ignoring float noise. */
export function hasEnough(available: number, needed: number): boolean {
  return available + EPSILON >= needed;
}

/**
 * Why a quantity can't be used for a product with this unit, or null when
 * it's fine: EACH must be a whole number, KG and L allow up to 3 decimals.
 * Zero and negatives are left to each form's own minimum.
 */
export function quantityError(value: number, unit: Unit | null | undefined): string | null {
  if (!Number.isFinite(value)) return "Enter a valid quantity.";
  if (isWeighed(unit)) {
    return Math.abs(roundQty(value) - value) > EPSILON
      ? `Use at most ${QTY_DECIMALS} decimals, for example 1.25.`
      : null;
  }
  return Number.isInteger(roundQty(value)) && Math.abs(Math.round(value) - value) <= EPSILON
    ? null
    : "This product is counted by the piece, so the quantity must be a whole number.";
}

/** "12", "1.35 kg", "2 L": the number without trailing zeros, plus the unit for weighed products. */
export function formatQty(value: number, unit?: Unit | null): string {
  const n = roundQty(value);
  // en-US like every other number in the app ("1,350.5"); en-ZA would
  // print "1 350,5", a comma decimal that reads as a different number.
  const text = n.toLocaleString("en-US", { maximumFractionDigits: QTY_DECIMALS });
  if (unit === "KG") return `${text} kg`;
  if (unit === "L") return `${text} L`;
  return text;
}

/** The input `step` for a quantity field: any decimal for weighed units, whole otherwise. */
export function qtyStep(unit: Unit | null | undefined): string {
  return isWeighed(unit) ? "0.001" : "1";
}
