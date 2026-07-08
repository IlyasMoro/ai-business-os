"use client";

import { useSyncExternalStore } from "react";
import { VIZ } from "./colors";

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function getSnapshot() {
  // Whole-second granularity so repeated calls within the same second return
  // an identical value — useSyncExternalStore requires getSnapshot to be
  // stable except when the subscribed callback actually fires.
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot() {
  return 0;
}

export function PulseClock() {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = nowSeconds * 1000;

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#111111] px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: VIZ.emerald }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: VIZ.emerald }} />
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-emerald-400">Live</span>
      <span className="font-mono text-xs tabular-nums text-slate-400">
        {now === 0 ? "--:--:--" : new Date(now).toLocaleTimeString("en-US", { hour12: false })}
      </span>
    </div>
  );
}
