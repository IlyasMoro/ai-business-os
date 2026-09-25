// Validated against the slate-950 dark surface via the dataviz skill's
// palette checker (lightness band, chroma floor, CVD separation, contrast —
// all pass). Status colors (good/warning/critical) always ship with an
// icon/label alongside them, never color alone.
export const VIZ = {
  blue: "#3b82f6",
  amber: "#d97706",
  emerald: "#059669",
  red: "#ef4444",
  bg: "#020617", // slate-950
  surface: "#0f172a", // slate-900
  border: "#1e293b", // slate-800
  borderLight: "#334155", // slate-700
  muted: "#64748b", // slate-500
  text: "#cbd5e1", // slate-300
} as const;

export function thresholdColor(pct: number, goodIsHigh: boolean) {
  const p = goodIsHigh ? pct : 100 - pct;
  if (p >= 70) return VIZ.emerald;
  if (p >= 40) return VIZ.amber;
  return VIZ.red;
}

/**
 * Maps a VIZ color, the same one already used to color a donut chart slice
 * or a status dot, to the matching Badge tone. Every list page already
 * defines a status to VIZ color lookup for its chart; this lets the status
 * cell in the table reuse that exact lookup to render a real Badge pill
 * instead of a small colored dot, so status stays immediately readable in
 * both places without keeping two separate color maps in sync.
 */
export function toneForVizColor(color: string): "slate" | "green" | "yellow" | "red" | "blue" {
  switch (color) {
    case VIZ.emerald:
      return "green";
    case VIZ.amber:
      return "yellow";
    case VIZ.red:
      return "red";
    case VIZ.blue:
      return "blue";
    default:
      return "slate";
  }
}
