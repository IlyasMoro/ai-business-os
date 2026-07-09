export default function DashboardLoading() {
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] animate-pulse bg-black p-4 sm:-m-6 sm:p-6">
      <div className="h-7 w-48 rounded-md bg-[#111111] light:bg-white" />
      <div className="mt-2 h-4 w-72 rounded-md bg-[#111111] light:bg-white" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white" />
        ))}
      </div>
    </div>
  );
}
