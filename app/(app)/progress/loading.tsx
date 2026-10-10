export default function ProgressLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-xl" />
        <div className="h-4 w-96 bg-muted/60 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-card/60 p-5 space-y-3">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="h-32 rounded-2xl border border-border bg-card/60 p-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl border border-border bg-card/60 p-6" />
        <div className="h-72 rounded-2xl border border-border bg-card/60 p-6" />
      </div>
    </div>
  );
}
