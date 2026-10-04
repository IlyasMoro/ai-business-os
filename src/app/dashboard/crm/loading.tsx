/** While a CRM view loads, only the content area shows this placeholder; the
 * CRM heading and tabs (the layout) stay where they are. */
export default function CrmLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-5 w-40 rounded-md glass" />
          <div className="mt-2 h-4 w-64 rounded-md glass" />
        </div>
        <div className="h-9 w-32 rounded-lg glass" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl border border-white/[0.09] glass light:border-white/80" />
        ))}
      </div>
    </div>
  );
}
