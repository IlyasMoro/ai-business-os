export function AiTerminalPreview() {
  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-left shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 font-mono text-xs text-slate-500">AI Copilot</span>
      </div>
      <div className="space-y-3 p-5 font-mono text-sm">
        <p className="text-slate-400">
          <span className="text-emerald-400">you</span> &gt; Which invoices are overdue this month?
        </p>
        <p className="text-slate-300">
          <span className="text-blue-400">aibos</span> &gt; 3 invoices totaling $4,280 are overdue.
          Want me to send reminders?
        </p>
        <p className="text-slate-400">
          <span className="text-emerald-400">you</span> &gt; Yes, send them
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle" />
        </p>
      </div>
    </div>
  );
}
