"use client";

import Link from "next/link";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";
import type { PlanItemResult } from "@/lib/learner/engine-v2";

interface DashboardPlanQueueProps {
  items: PlanItemResult[];
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}

export function DashboardPlanQueue({
  items,
  onComplete,
  onSkip,
}: DashboardPlanQueueProps) {
  const remainingCount = items.filter((i) => i.status !== "completed").length;
  const totalPendingMinutes = items
    .filter((i) => i.status === "pending")
    .reduce((a, b) => a + b.estMinutes, 0);

  return (
    <div className="rounded-3xl border border-primary/20 bg-card/70 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Daily Learning Queue
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Today&apos;s Targeted Tasks ({remainingCount} remaining)
          </h2>
        </div>
        <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary w-fit">
          Est. Time: {totalPendingMinutes} mins
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => {
          const isCompleted = item.status === "completed";
          const isSkipped = item.status === "skipped";

          const badgeColor =
            item.type === "review"
              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
              : item.type === "practice"
              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
              : item.type === "micro_lesson"
              ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
              : "bg-purple-500/10 text-purple-500 border-purple-500/20";

          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition duration-200 ${
                isCompleted
                  ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                  : isSkipped
                  ? "border-border bg-muted/40 opacity-50"
                  : "border-border bg-background/60 hover:border-primary/40 shadow-sm"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                    {item.type.replace("_", " ")}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                    <Clock className="h-3 w-3" />
                    {item.estMinutes}m
                  </span>
                </div>

                <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  <span>{item.conceptName}</span>
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.reason}
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-2 mt-4">
                {!isCompleted && !isSkipped ? (
                  <>
                    <Link
                      href={
                        item.type === "review" || item.type === "practice"
                          ? `/quiz?mode=topic&slug=${item.conceptSlug}`
                          : `/chat?topic=${item.conceptSlug}`
                      }
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                    >
                      Start Task →
                    </Link>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onComplete(item.id)}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent transition"
                        title="Mark complete"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => onSkip(item.id)}
                        className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                        title="Skip task"
                      >
                        Skip
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-xs font-semibold capitalize text-muted-foreground">
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
