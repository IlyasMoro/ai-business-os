import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

const CTA_CLASS =
  "border-transparent bg-white text-[#0a1428] shadow-lg shadow-black/40 hover:bg-blue-50 hover:shadow-xl";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050b1e]/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs font-bold text-slate-50 backdrop-blur-md">
            AI
          </span>
          Business OS
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="hidden px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-slate-50 sm:inline-block"
          >
            Pricing
          </Link>
          <LinkButton href="/login" variant="glass" size="sm" className="border-transparent bg-transparent hover:border-white/15 hover:bg-white/5">
            Sign in
          </LinkButton>
          <LinkButton href="/register" variant="glass" size="sm" className={CTA_CLASS}>
            Get started
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
