import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050b1e]/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex h-8 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 text-xs font-bold tracking-wide text-amber-400 backdrop-blur-md">
            AIBOS
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="px-2 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-slate-50 sm:px-3"
          >
            Pricing
          </Link>
          <LinkButton href="/login" variant="glass" size="sm" className="border-transparent bg-transparent hover:border-white/15 hover:bg-white/5">
            Sign in
          </LinkButton>
          <Link
            href="/register"
            className="px-2 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300 sm:px-3"
          >
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
