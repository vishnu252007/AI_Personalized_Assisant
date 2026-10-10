export function DashboardChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-64 w-full bg-muted/40 rounded-xl flex items-center justify-center">
          <div className="h-6 w-32 bg-muted/60 rounded" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-64 w-full bg-muted/40 rounded-xl flex items-center justify-center">
          <div className="h-6 w-32 bg-muted/60 rounded" />
        </div>
      </div>
    </div>
  );
}
