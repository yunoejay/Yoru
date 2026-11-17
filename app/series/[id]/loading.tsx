export default function SeriesLoading() {
  return (
    <div className="space-y-10 pb-10">
      <div className="hero-panel">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[280px_1fr] lg:p-10">
          <div className="skeleton mx-auto h-[400px] w-full max-w-[280px] rounded-[1.5rem]" />
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="skeleton h-6 w-20 rounded-full" />
              <div className="skeleton h-6 w-24 rounded-full" />
            </div>
            <div className="skeleton h-10 w-2/3" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-4/5" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="skeleton h-6 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
