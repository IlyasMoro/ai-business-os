import { cn } from "@/lib/utils";

/**
 * The frame for pages the company's own customers see (a quote to accept,
 * the web lead form, unsubscribing): the company's logo or name on top,
 * always light, and a quiet AIBOS credit at the bottom. `bare` drops the
 * page background for the lead form embedded in another website.
 */
export function CustomerShell({
  company,
  children,
  width = "max-w-2xl",
  bare = false,
}: {
  company: { id: string; name: string; hasLogo: boolean };
  children: React.ReactNode;
  width?: string;
  bare?: boolean;
}) {
  return (
    <div className={cn("min-h-screen text-slate-900", bare ? "bg-transparent px-1 py-2" : "bg-slate-100 px-4 py-10 sm:py-16")} style={{ colorScheme: "light" }}>
      <div className={cn("mx-auto", width)}>
        {!bare && (
          <div className="mb-6 flex items-center justify-center">
            {company.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/company-logo/${company.id}`} alt={company.name} className="h-10 w-auto max-w-[220px] object-contain" />
            ) : (
              <p className="font-display text-xl font-semibold tracking-tight text-slate-900">{company.name}</p>
            )}
          </div>
        )}
        <div className={cn("rounded-2xl border border-slate-200 bg-white", bare ? "p-5" : "p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] sm:p-8")}>{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by{" "}
          <a href="/" target="_blank" rel="noreferrer" className="font-medium text-slate-500 hover:text-slate-700">
            AIBOS
          </a>
        </p>
      </div>
    </div>
  );
}

/** Field look for the light customer pages. */
export const publicField =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15";

export const publicLabel = "mb-1.5 block text-sm font-medium text-slate-700";

export const publicButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50";

export const publicGhostButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/30";
