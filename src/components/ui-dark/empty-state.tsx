import type { LucideIcon } from "lucide-react";
import { LinkButton } from "./button";

/** Friendly placeholder for a list with nothing in it yet (or no search
 * matches): icon, short title, one line of guidance and a next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string; variant?: "primary" | "secondary" };
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-300 light:border-blue-600/20 light:bg-blue-600/10 light:text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-50 light:text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400 light:text-slate-500">{description}</p>
      {action && (
        <LinkButton href={action.href} variant={action.variant ?? "primary"} className="mt-5">
          {action.label}
        </LinkButton>
      )}
    </div>
  );
}
