export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-muted rounded-xl" />
          <div className="h-4 w-96 bg-muted/60 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded-lg" />
          <div className="h-9 w-32 bg-primary/20 rounded-lg" />
        </div>
      </div>

      {/* Plan Card skeleton */}
      <div className="rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-border/40">
          <div className="h-6 w-48 bg-muted rounded-lg" />
          <div className="h-6 w-24 bg-muted/60 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl border border-border/50 bg-background/50 p-5 space-y-4">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-6 w-36 bg-muted rounded" />
              <div className="h-12 w-full bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Simulator skeleton */}
      <div className="h-32 rounded-3xl border border-border/60 bg-card/60 p-6" />
    </div>
  );
}
