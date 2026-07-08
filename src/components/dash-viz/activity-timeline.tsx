import { VIZ } from "./colors";

export type TimelineItem = {
  id: string;
  title: string;
  meta: string;
  when: string;
  tone: "blue" | "amber" | "emerald" | "red";
};

const toneColor: Record<TimelineItem["tone"], string> = {
  blue: VIZ.blue,
  amber: VIZ.amber,
  emerald: VIZ.emerald,
  red: VIZ.red,
};

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No recent activity yet.</p>;
  }

  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span
              aria-hidden
              className="absolute left-[5px] top-3 h-full w-px"
              style={{ backgroundColor: VIZ.border }}
            />
          )}
          <span
            className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4"
            style={{ backgroundColor: toneColor[item.tone], boxShadow: `0 0 8px ${toneColor[item.tone]}`, "--tw-ring-color": VIZ.bg } as React.CSSProperties}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-200">{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{item.meta}</p>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">{item.when}</span>
        </li>
      ))}
    </ol>
  );
}
