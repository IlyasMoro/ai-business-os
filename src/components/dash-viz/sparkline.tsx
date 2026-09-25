"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Sparkline({
  data,
  color,
  width = 96,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gradientId = useId();
  const glowId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Same draw-in technique as RingGauge: start undrawn (dashoffset 1 with a
  // normalized pathLength), transition to 0 right after mount, respecting
  // prefers-reduced-motion. A CSS transition, not @keyframes, to keep this
  // consistent with the rest of dash-viz.
  const [drawn, setDrawn] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { points, linePath, areaPath, stepX } = useMemo(() => {
    if (data.length === 0) return { points: [] as (readonly [number, number])[], linePath: "", areaPath: "", stepX: 0 };
    const max = Math.max(...data, 0.0001);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / Math.max(1, data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y] as const;
    });

    const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
    return { points, linePath, areaPath, stepX };
  }, [data, width, height]);

  if (points.length === 0) return null;

  const lastIndex = points.length - 1;
  const activeIndex = hoverIndex ?? lastIndex;
  const [activeX, activeY] = points[activeIndex];
  const activeValue = data[activeIndex];

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current || stepX === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const nearest = Math.max(0, Math.min(lastIndex, Math.round(relX / stepX)));
    setHoverIndex(nearest);
  }

  // Anchor the tooltip's horizontal position by which third of the chart the
  // active point falls in, so it never overflows past the container edge.
  const align = activeX < width / 3 ? "left" : activeX > (width * 2) / 3 ? "right" : "center";

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.38} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.5s ease 0.3s" }}
        />

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {hoverIndex !== null && (
          <line x1={activeX} y1={0} x2={activeX} y2={height} stroke={color} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 2" />
        )}

        <circle
          cx={activeX}
          cy={activeY}
          r={hoverIndex !== null ? 4 : 3}
          fill={color}
          stroke="#000000"
          strokeWidth={2}
          filter={hoverIndex !== null ? `url(#${glowId})` : undefined}
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.3s ease 0.7s, r 0.15s ease" }}
        />
      </svg>

      {hoverIndex !== null && (
        <div
          className={`pointer-events-none absolute -top-1 -translate-y-full rounded-md border border-white/10 light:border-slate-200 bg-[#0b0b0b] light:bg-white px-2 py-1 text-xs font-mono tabular-nums text-slate-50 light:text-slate-900 shadow-lg ${
            align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {activeValue.toLocaleString()}
        </div>
      )}
    </div>
  );
}
