/** The dashboard's dark aurora for the public pages (landing, pricing,
 * legal, error). Those pages are designed dark only, so this deliberately
 * ignores the light theme instead of following body::before. The parent
 * needs `isolate` so this -z-10 layer sits above its background but behind
 * its content. */
export function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#03050b]">
      <div
        className="absolute inset-[-15%] animate-[aurora-drift_48s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
        style={{
          background: [
            "radial-gradient(ellipse 45% 40% at 12% 8%, rgb(59 130 246 / 0.36), transparent 65%)",
            "radial-gradient(ellipse 40% 38% at 90% 14%, rgb(139 92 246 / 0.34), transparent 65%)",
            "radial-gradient(ellipse 45% 40% at 60% 96%, rgb(20 184 166 / 0.26), transparent 65%)",
            "radial-gradient(ellipse 30% 28% at 32% 60%, rgb(236 72 153 / 0.11), transparent 70%)",
          ].join(", "),
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 120% 100% at 50% 40%, transparent 60%, rgb(0 0 0 / 0.32))" }}
      />
    </div>
  );
}
