"use client";

import { useEffect, useState } from "react";

/**
 * A number on the sign in panel that counts up from zero once, after
 * `delay` seconds. The server renders the final value, so the figure is
 * right without JavaScript and for people who turn motion off; the count
 * runs while its tile is still fading in, so the reset to zero never shows.
 */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  delay = 0,
  duration = 1.2,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  duration?: number;
}) {
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / (duration * 1000)));
      // Ease out: quick at first, settling gently on the final number.
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, duration]);

  return (
    <>
      {prefix}
      {value.toLocaleString("en-US")}
      {suffix}
    </>
  );
}
