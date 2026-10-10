export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-64 sm:w-72 border-r border-border bg-card/40 p-4 space-y-3 hidden md:flex flex-col">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-8 w-full bg-muted/60 rounded-lg" />
        <div className="space-y-2 pt-2 flex-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-full bg-muted/40 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Main chat skeleton */}
      <div className="flex-1 flex flex-col h-full">
        <div className="h-12 border-b border-border/60 bg-card/20 px-4 flex items-center justify-between">
          <div className="h-6 w-28 bg-muted rounded-full" />
          <div className="h-6 w-36 bg-muted rounded-lg" />
        </div>

        <div className="flex-1 p-6 space-y-4">
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="h-8 w-8 rounded-xl bg-muted shrink-0" />
            <div className="h-20 w-80 rounded-2xl bg-muted/40" />
          </div>
          <div className="flex gap-3 max-w-md ml-auto justify-end">
            <div className="h-12 w-48 rounded-2xl bg-primary/20" />
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card/40">
          <div className="h-12 max-w-3xl mx-auto bg-muted/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
