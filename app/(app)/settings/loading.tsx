export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded-xl" />
        <div className="h-4 w-96 bg-muted/60 rounded-lg" />
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <div className="h-5 w-40 bg-muted rounded" />
        <div className="space-y-3">
          <div className="h-16 w-full bg-background/50 rounded-xl" />
          <div className="h-16 w-full bg-background/50 rounded-xl" />
        </div>
      </div>

      <div className="h-44 rounded-2xl border border-border bg-card/60 p-6" />
      <div className="h-48 rounded-2xl border border-border bg-card/60 p-6" />
    </div>
  );
}
