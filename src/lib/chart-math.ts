/* Pure helpers for the dash-viz charts: axis scales, period over period
   change and compact number labels. Kept free of React so they can be
   unit tested. */

/** A round axis maximum at or above `max`: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= max) return step * power;
  }
  return 10 * power;
}

export type Change =
  | { kind: "pct"; pct: number; direction: "up" | "down" | "flat" }
  | { kind: "from-zero" }
  | { kind: "none" };

/** Change from the previous value to the latest one. */
export function periodChange(values: number[]): Change {
  if (values.length < 2) return { kind: "none" };
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  if (previous === 0) return current > 0 ? { kind: "from-zero" } : { kind: "none" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return { kind: "pct", pct: rounded, direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat" };
}

/** Short axis label: 950, 1.2k, 3.4M; with a $ when `currency`. */
export function compactNumber(value: number, currency = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency ? "$" : "";
  const fmt = (n: number, suffix: string) => `${sign}${prefix}${Number(n.toFixed(n < 10 ? 1 : 0))}${suffix}`;
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "M");
  if (abs >= 1_000) return fmt(abs / 1_000, "k");
  return `${sign}${prefix}${Math.round(abs)}`;
}

/** Full value for tooltips and tables: $1,234.50 or 1,234. */
export function fullNumber(value: number, currency = false): string {
  return currency
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : value.toLocaleString("en-US");
}

/** Share of the total as a whole percent, keeping tiny non zero shares visible as "<1%". */
export function sharePct(value: number, total: number): string {
  if (total <= 0 || value <= 0) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}
