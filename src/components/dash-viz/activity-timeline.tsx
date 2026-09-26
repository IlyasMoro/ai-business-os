import Link from "next/link";
import { VIZ } from "./colors";

export type TimelineItem = {
  id: string;
  title: string;
  meta: string;
  when: string;
  tone: "blue" | "amber" | "emerald" | "red";
  /** The record this entry is about, when it has a page. */
  href?: string | null;
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
            <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-white/[0.08] light:bg-slate-900/[0.1]" />
          )}
          <span
            className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-slate-950 light:ring-white"
            style={{ backgroundColor: toneColor[item.tone] }}
          />
          <div className="min-w-0 flex-1">
            {item.href ? (
              <Link href={item.href} className="block truncate text-sm text-slate-200 hover:text-blue-400 light:text-slate-800">
                {item.title}
              </Link>
            ) : (
              <p className="truncate text-sm text-slate-200 light:text-slate-800">{item.title}</p>
            )}
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.meta}</p>
            {/* Time sits under the text so narrow cards keep the title readable. */}
            <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-600 light:text-slate-400">{item.when}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
