import Link from "next/link";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-surface sm:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-sm">
            AI
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Business OS
          </span>
        </Link>
      </div>
      <NavLinks role={role} />
    </aside>
  );
}
