"use client";

import { useRef } from "react";

/**
 * A card whose glow and border light up around the pointer (see .spotlight
 * in globals.css). The position is written straight to CSS variables, so
 * moving the mouse never re-renders React.
 */
export function SpotlightCard({
  color,
  className = "",
  children,
}: {
  color?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      className={`spotlight ${className}`}
      style={color ? ({ "--spot": color } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
