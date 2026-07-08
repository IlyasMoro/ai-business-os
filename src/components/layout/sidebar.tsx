import Link from "next/link";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950 sm:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/20 text-xs font-bold text-amber-400">
            AI
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            Business OS
          </span>
        </Link>
      </div>
      <NavLinks role={role} />
    </aside>
  );
}
