export default function QuizLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-muted mx-auto" />
        <div className="h-8 w-64 bg-muted rounded-xl mx-auto" />
        <div className="h-4 w-96 bg-muted/60 rounded mx-auto" />
      </div>

      <div className="rounded-3xl border border-border bg-card/60 p-8 space-y-6">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl border border-border bg-background/50 p-4 space-y-2">
              <div className="h-5 w-24 bg-muted rounded" />
              <div className="h-8 w-full bg-muted/40 rounded" />
            </div>
          ))}
        </div>
        <div className="h-12 w-full bg-primary/20 rounded-xl" />
      </div>
    </div>
  );
}
