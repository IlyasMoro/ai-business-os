export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span className="flex items-center gap-2 font-medium text-slate-300">
          <span className="flex h-6 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/20 px-2 text-[10px] font-bold tracking-wide text-amber-400">
            AIBOS
          </span>
        </span>
        <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
