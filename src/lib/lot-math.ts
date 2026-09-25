export const TrackingModeValues = ["NONE", "LOT", "SERIAL"] as const;
export type TrackingMode = (typeof TrackingModeValues)[number];

export const PickingRuleValues = ["FIFO", "FEFO"] as const;
export type PickingRule = (typeof PickingRuleValues)[number];

export type StockLot = {
  id: string;
  lotNumber: string;
  quantity: number;
  expiresAt: Date | null;
  receivedAt: Date;
};

export function isExpired(lot: Pick<StockLot, "expiresAt">, today: Date = new Date()): boolean {
  return lot.expiresAt !== null && lot.expiresAt.getTime() < startOfDay(today).getTime();
}

export function isExpiringSoon(lot: Pick<StockLot, "expiresAt">, warnDays: number, today: Date = new Date()): boolean {
  if (lot.expiresAt === null || isExpired(lot, today)) return false;
  return lot.expiresAt.getTime() <= startOfDay(today).getTime() + warnDays * 24 * 60 * 60 * 1000;
}

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Chooses which lots to take `quantity` units from.
 * FIFO takes the oldest receipt first. FEFO takes whatever expires first
 * (lots with no expiry go last), which is what food and pharmacy need.
 * Expired lots are skipped when the business blocks them.
 */
export function pickLots(
  lots: StockLot[],
  quantity: number,
  opts: { rule: PickingRule; blockExpired: boolean; today?: Date }
): { allocations: { lotId: string; lotNumber: string; quantity: number }[]; shortfall: number } {
  const today = opts.today ?? new Date();
  const usable = lots.filter((l) => l.quantity > 0 && !(opts.blockExpired && isExpired(l, today)));
  const byReceipt = (a: StockLot, b: StockLot) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.lotNumber.localeCompare(b.lotNumber);
  const sorted = [...usable].sort(
    opts.rule === "FEFO"
      ? (a, b) => {
          if (a.expiresAt && b.expiresAt) return a.expiresAt.getTime() - b.expiresAt.getTime() || byReceipt(a, b);
          if (a.expiresAt) return -1;
          if (b.expiresAt) return 1;
          return byReceipt(a, b);
        }
      : byReceipt
  );

  const allocations: { lotId: string; lotNumber: string; quantity: number }[] = [];
  let remaining = quantity;
  for (const lot of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, quantity: take });
    remaining -= take;
  }
  return { allocations, shortfall: Math.max(0, remaining) };
}

const CODE = /^[A-Za-z0-9._/ :#-]{1,60}$/;

/** Lot and serial numbers are the supplier's own codes, so keep the rules loose. */
export function isValidTrackingCode(code: string): boolean {
  return CODE.test(code) && code.trim() === code && code.length > 0;
}

/**
 * Reads serial numbers typed one per line (or separated by commas) and
 * checks there's exactly one per unit, with no repeats.
 */
export function parseSerials(text: string, expected: number): { serials: string[]; error: string | null } {
  const serials = text
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = serials.find((s) => !isValidTrackingCode(s));
  if (bad) return { serials, error: `"${bad}" isn't a valid serial number.` };
  const dupes = serials.filter((s, i) => serials.indexOf(s) !== i);
  if (dupes.length > 0) return { serials, error: `Serial ${dupes[0]} is listed twice.` };
  if (serials.length !== expected) {
    return { serials, error: `Enter exactly ${expected} serial number${expected === 1 ? "" : "s"}, one per unit (got ${serials.length}).` };
  }
  return { serials, error: null };
}

/** Serial numbers for units built on a work order: WO0001S001, WO0001S002, ... */
export function generateSerials(prefix: string, count: number): string[] {
  const width = Math.max(3, String(count).length);
  return Array.from({ length: count }, (_, i) => `${prefix}S${String(i + 1).padStart(width, "0")}`);
}

/** The latest expiry date still inside the warning window. */
export function expiryWarningCutoff(warnDays: number, today: Date = new Date()): Date {
  return new Date(startOfDay(today).getTime() + (warnDays + 1) * 24 * 60 * 60 * 1000);
}
