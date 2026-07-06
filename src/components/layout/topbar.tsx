import { logout } from "@/lib/actions/auth";
import { LogOut } from "lucide-react";

export function Topbar({
  companyName,
  userName,
}: {
  companyName: string;
  userName: string;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-sm font-semibold text-slate-900">{companyName}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">{userName}</span>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
