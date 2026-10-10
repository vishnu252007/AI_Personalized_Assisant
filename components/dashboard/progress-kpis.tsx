import { Award, Brain, Zap, Clock } from "lucide-react";

interface ProgressKPIsProps {
  summary: {
    assessmentAccuracy: number;
    trackedTopics: number;
    totalAttempts: number;
    reviewQueueCount: number;
  };
}

export function ProgressKPIs({ summary }: ProgressKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
          <Award className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-black text-foreground">
          {summary.assessmentAccuracy}%
        </div>
        <p className="text-[11px] text-muted-foreground">Overall quiz correctness</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Concepts Tracked</span>
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-black text-foreground">
          {summary.trackedTopics}
        </div>
        <p className="text-[11px] text-muted-foreground">Across curriculum nodes</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Questions Answered</span>
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <div className="text-2xl font-black text-foreground">
          {summary.totalAttempts}
        </div>
        <p className="text-[11px] text-muted-foreground">Graded interactions</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Review Queue</span>
          <Clock className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-2xl font-black text-foreground">
          {summary.reviewQueueCount}
        </div>
        <p className="text-[11px] text-muted-foreground">Due on forgetting curve</p>
      </div>
    </div>
  );
}
