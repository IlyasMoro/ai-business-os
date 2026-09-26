import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/login", label: "Sign in" },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Logo alwaysDark />
          </Link>
          <p className="mt-2 text-sm text-slate-400">Run your business, with AI that asks before it acts.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-slate-400 transition-colors hover:text-slate-50">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-white/[0.06] pt-6 text-xs text-slate-500">
        © {new Date().getFullYear()} AIBOS. All rights reserved.
      </p>
    </footer>
  );
}
