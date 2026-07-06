export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded-md bg-slate-200" />
      <div className="mt-2 h-4 w-72 rounded-md bg-slate-100" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-slate-200 bg-surface" />
        ))}
      </div>
    </div>
  );
}
