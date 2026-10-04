/* Customer tag colours, shared by the settings page, the customer list and
   the customer page. No database access here. */

export const TAG_COLORS = [
  { id: "blue", label: "Blue", chip: "border-blue-500/40 bg-blue-500/10 text-blue-300 light:text-blue-700", dot: "bg-blue-500" },
  { id: "green", label: "Green", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 light:text-emerald-700", dot: "bg-emerald-500" },
  { id: "amber", label: "Amber", chip: "border-amber-500/40 bg-amber-500/10 text-amber-300 light:text-amber-700", dot: "bg-amber-500" },
  { id: "red", label: "Red", chip: "border-red-500/40 bg-red-500/10 text-red-300 light:text-red-700", dot: "bg-red-500" },
  { id: "purple", label: "Purple", chip: "border-purple-500/40 bg-purple-500/10 text-purple-300 light:text-purple-700", dot: "bg-purple-500" },
  { id: "cyan", label: "Cyan", chip: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 light:text-cyan-700", dot: "bg-cyan-500" },
  { id: "slate", label: "Grey", chip: "border-slate-500/40 bg-slate-500/10 text-slate-300 light:text-slate-700", dot: "bg-slate-400" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["id"];

export const TAG_COLOR_IDS = TAG_COLORS.map((c) => c.id) as [TagColor, ...TagColor[]];

export function tagColor(id: string) {
  return TAG_COLORS.find((c) => c.id === id) ?? TAG_COLORS[0];
}

/** Tags a company can have; plenty for labels, few enough to stay readable. */
export const MAX_TAGS = 30;
