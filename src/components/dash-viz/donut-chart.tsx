"use client";

import { useEffect, useState } from "react";
import { sharePct } from "@/lib/chart-math";

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Surface gap between neighbouring slices, in px of arc. */
const GAP = 2;

/**
 * Share of a whole, as a ring with a legend. The legend sits beside the
 * ring when the card is wide enough and below it when narrow (a container
 * query, so it adapts to the card, not the window). Hovering or focusing a
 * slice or legend row shows that slice in the centre and fades the others.
 * Every slice is labelled with its count and share, so identity never
 * rests on colour alone; a screen reader table carries the same data.
 */
export function DonutChart({
  title,
  centerValue,
  centerLabel,
  slices,
  size = 150,
  strokeWidth = 14,
}: {
  title: string;
  centerValue: string;
  centerLabel: string;
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const radius = (size - strokeWidth) / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const nonZero = slices.filter((s) => s.value > 0).length;
  // Gaps only make sense between two or more visible slices.
  const gap = nonZero > 1 ? GAP : 0;

  type Arc = { slice: DonutSlice; i: number; fraction: number; start: number; length: number; offset: number };
  const arcs = slices.reduce<Arc[]>((acc, slice, i) => {
    const prev = acc[acc.length - 1];
    const start = prev ? prev.start + prev.fraction : 0;
    const fraction = total > 0 ? slice.value / total : 0;
    const length = Math.max(0, fraction * circumference - gap);
    acc.push({ slice, i, fraction, start, length, offset: -(start * circumference + gap / 2) });
    return acc;
  }, []);

  // Non zero statuses first in their fixed order, zero ones after, dimmed.
  const legend = [...arcs.filter((a) => a.slice.value > 0), ...arcs.filter((a) => a.slice.value === 0)];
  const focused = active !== null ? arcs[active] : null;
  // Nothing recorded at all: say so once rather than listing every status at 0.
  const empty = total === 0;
  const emptyMessage = /^[a-z]+s$/.test(centerLabel) ? `No ${centerLabel} yet` : "Nothing recorded yet";

  return (
    <div className="@container w-full min-w-0 flex-1">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center @md:gap-8">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={empty ? "2 5" : undefined}
              className="stroke-white/[0.07] light:stroke-slate-900/[0.08]"
            />
            {arcs.map(({ slice, i, length, offset }) => {
              if (slice.value === 0) return null;
              const isActive = active === i;
              return (
                <circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isActive ? strokeWidth + 5 : strokeWidth}
                  strokeDasharray={`${drawn ? length : 0} ${circumference}`}
                  strokeDashoffset={offset}
                  opacity={active === null || isActive ? 1 : 0.3}
                  className="cursor-pointer"
                  style={{
                    transition: `stroke-dasharray 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms, stroke-width 0.2s ease, opacity 0.2s ease`,
                  }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
          </svg>
          {/* Centre: the total, or the slice being looked at. */}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
            aria-live="polite"
          >
            {focused ? (
              <>
                <span className="font-mono text-2xl font-semibold tabular-nums text-slate-50 light:text-slate-900">
                  {focused.slice.value.toLocaleString()}
                </span>
                <span className="max-w-[80%] truncate text-[11px] text-slate-400 light:text-slate-500">
                  {focused.slice.label} · {sharePct(focused.slice.value, total)}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-2xl font-semibold tabular-nums text-slate-50 light:text-slate-900">
                  {centerValue}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-slate-500">{centerLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full min-w-0 @md:flex-1">
          <p className="mb-3 text-center text-xs font-semibold text-slate-300 light:text-slate-700 @md:text-left">{title}</p>
          {empty ? (
            <p className="text-center text-xs text-slate-500 @md:text-left">
              {emptyMessage}. The breakdown appears here once there is some.
            </p>
          ) : (
            <ul className="space-y-1">
              {legend.map(({ slice, i, fraction }) => {
                const zero = slice.value === 0;
                const isActive = active === i;
                return (
                  <li key={slice.label}>
                    <button
                      type="button"
                      disabled={zero}
                      onMouseEnter={() => !zero && setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => !zero && setActive(i)}
                      onBlur={() => setActive(null)}
                      className={`relative w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        zero
                          ? "cursor-default opacity-45"
                          : "hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none light:hover:bg-slate-900/[0.04]"
                      } ${isActive ? "bg-white/[0.05] light:bg-slate-900/[0.05]" : ""}`}
                    >
                      <span className="relative flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-slate-300 light:text-slate-700">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: slice.color }} />
                          <span className="truncate">{slice.label}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
                          <span className="text-slate-200 light:text-slate-800">{slice.value.toLocaleString()}</span>
                          <span className="w-9 text-right text-[11px] text-slate-500">{sharePct(slice.value, total)}</span>
                        </span>
                      </span>
                      {/* Thin share bar under the row, in the slice colour. */}
                      <span
                        aria-hidden="true"
                        className="relative mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06] light:bg-slate-900/[0.07]"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: drawn ? `${fraction * 100}%` : "0%",
                            backgroundColor: slice.color,
                            transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
                          }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {slices.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{s.value.toLocaleString()}</td>
              <td>{sharePct(s.value, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
