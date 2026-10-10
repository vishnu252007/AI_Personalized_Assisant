import Link from "next/link";
import type { TopicMetric } from "@/lib/learner/overview";

interface TopicMasteryGridProps {
  topics: TopicMetric[];
}

export function TopicMasteryGrid({ topics }: TopicMasteryGridProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <h3 className="font-bold text-sm text-foreground">
        Curriculum Topic Mastery & Retention Status
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(topics || []).map((t) => {
          const isMastered = t.state === "mastered";
          const isStarted = t.state === "in_progress";
          return (
            <div
              key={t.topicId}
              className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground truncate max-w-[180px]">
                  {t.topicName}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    isMastered
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : isStarted
                      ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isMastered ? "Mastered" : isStarted ? "In Progress" : "Not Started"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Mastery Score:</span>
                  <span className="font-mono font-medium text-foreground">
                    {Math.round(t.masteryScore * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Retention Prob:</span>
                  <span className="font-mono font-medium text-foreground">
                    {Math.round(t.retentionProbability * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Half-Life:</span>
                  <span className="font-mono font-medium text-foreground">
                    {Number(t.halfLifeDays).toFixed(1)} days
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                <Link href={`/chat?topic=${t.topicSlug}`} className="text-primary hover:underline">
                  Discuss
                </Link>
                <Link
                  href={`/quiz?slug=${t.topicSlug}`}
                  className="text-muted-foreground hover:text-foreground font-medium"
                >
                  Quiz &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
