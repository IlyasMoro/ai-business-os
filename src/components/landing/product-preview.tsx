import Image from "next/image";

export function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <div className="flex-1 rounded-md bg-white/5 px-3 py-1 text-center font-mono text-xs text-slate-500">
          app.aibos.com/dashboard
        </div>
      </div>
      <Image
        src="/screenshots/dashboard-overview.png"
        alt="AIBOS dashboard overview showing revenue, active projects, customers, and performance metrics"
        width={1500}
        height={660}
        className="w-full"
        priority
      />
    </div>
  );
}
