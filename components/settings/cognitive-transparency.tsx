"use client";

import { Brain } from "lucide-react";
import type { InsightsResponse } from "@/lib/learner/overview";

interface CognitiveTransparencyProps {
  insights: InsightsResponse | null | undefined;
  loading: boolean;
}

export function CognitiveTransparency({
  insights,
  loading,
}: CognitiveTransparencyProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 space-y-6 shadow-md backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-primary/10 pb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            How the Tutor Adapts to You (Cognitive Model)
          </h2>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
          Bayesian Calibrated
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Loading cognitive profile insights...
        </div>
      ) : insights ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card/80 p-4 text-xs text-foreground leading-relaxed">
            <p className="font-medium text-foreground">{insights.adaptationSummary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Explanation Depth
              </span>
              <span className="text-xs font-bold text-primary block">
                {insights.traits.depthDescription}
              </span>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Teaching Modality
              </span>
              <span className="text-xs font-bold text-primary block">
                {insights.traits.styleDescription}
              </span>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Curriculum Pace
              </span>
              <span className="text-xs font-bold text-primary block">
                {insights.traits.paceDescription}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              🎯 Daily Mastery Goal: <strong>{insights.traits.dailyGoalMinutes} mins/day</strong>
            </span>
            <span>
              Mastered: <strong className="text-emerald-500">{insights.strengths.length}</strong> | In Progress: <strong className="text-amber-500">{insights.weaknesses.length}</strong>
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Complete your first Socratic chat or practice quiz to populate your personalized cognitive profile.
        </p>
      )}
    </div>
  );
}
