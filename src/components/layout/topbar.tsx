import { logout } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogOut } from "lucide-react";

export function Topbar({
  companyName,
  userName,
}: {
  companyName: string;
  userName: string;
}) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-surface px-6">
      <div>
        <p className="text-sm font-semibold text-slate-900">{companyName}</p>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="mx-2 h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
            {initial}
          </span>
          <span className="text-sm text-slate-600">{userName}</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
