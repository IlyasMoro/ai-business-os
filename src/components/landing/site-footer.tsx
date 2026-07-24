export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span className="rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-sm font-extrabold tracking-tight text-blue-300 backdrop-blur-md">
          AIBOS
        </span>
        <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
