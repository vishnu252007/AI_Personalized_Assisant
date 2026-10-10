import { Brain } from "lucide-react";
import type { InsightsResponse } from "@/lib/learner/overview";

interface ProgressInsightsProps {
  insights: InsightsResponse;
}

export function ProgressInsights({ insights }: ProgressInsightsProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="font-bold text-sm text-foreground">
          Learner Profile Transparency
        </h3>
      </div>
      <p className="text-xs text-foreground/90 leading-relaxed">
        {insights.adaptationSummary}
      </p>
      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
        <span className="rounded-full border border-border bg-accent/40 px-3 py-1 text-muted-foreground">
          Style: <strong>{insights.traits.styleDescription}</strong>
        </span>
        <span className="rounded-full border border-border bg-accent/40 px-3 py-1 text-muted-foreground">
          Pace: <strong>{insights.traits.paceDescription}</strong>
        </span>
        <span className="rounded-full border border-border bg-accent/40 px-3 py-1 text-muted-foreground">
          Depth: <strong>{insights.traits.depthDescription}</strong>
        </span>
      </div>
    </div>
  );
}
