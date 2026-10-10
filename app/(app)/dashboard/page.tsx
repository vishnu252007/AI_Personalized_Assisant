"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, RefreshCw, Zap, TrendingUp, Sparkles } from "lucide-react";
import { useOverviewQuery } from "@/lib/hooks/use-learn-query";
import { DashboardPlanQueue } from "@/components/dashboard/dashboard-plan-queue";
import { DashboardSimulator } from "@/components/dashboard/dashboard-simulator";

export default function DashboardPage() {
  const { data: overview, isLoading, error, refetch } = useOverviewQuery();
  const [demoDay, setDemoDay] = React.useState<number>(7);
  const [localOverrides, setLocalOverrides] = React.useState<Record<string, "completed" | "skipped">>({});

  const planItems = React.useMemo(() => {
    const rawItems = overview?.plan?.items || [];
    return rawItems.map((item) => ({
      ...item,
      status: localOverrides[item.id] || item.status,
    }));
  }, [overview?.plan?.items, localOverrides]);

  const handleComplete = async (itemId: string) => {
    setLocalOverrides((prev) => ({ ...prev, [itemId]: "completed" }));
    try {
      await fetch(`/api/plan/items/${itemId}/complete`, { method: "POST" });
    } catch {
      // Ignored
    }
  };

  const handleSkip = async (itemId: string) => {
    setLocalOverrides((prev) => ({ ...prev, [itemId]: "skipped" }));
    try {
      await fetch(`/api/plan/items/${itemId}/skip`, { method: "POST" });
    } catch {
      // Ignored
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">
            Calculating Elo mastery & spaced repetition curves...
          </span>
        </div>
      </div>
    );
  }

  const studyNext = overview?.dashboard?.studyNext || {
    name: "Arrays & Hashing",
    slug: "arrays-and-hashing",
    reason: "Curriculum foundation milestone",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-20 md:pb-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarCheck className="h-7 w-7 text-primary" />
            <span>Today&apos;s Plan</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Personalized daily learning path calibrated by cognitive state & Ebbinghaus retention
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            href="/progress"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>Progress Analytics</span>
          </Link>
          <Link
            href="/quiz?mode=diagnostic"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Quick Practice</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          Failed to synchronize latest cloud data. Displaying cached session state.
        </div>
      )}

      {/* Recommended Next Milestone Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Recommended Next Focus</span>
          </div>
          <h3 className="text-base font-bold text-foreground">{studyNext.name}</h3>
          <p className="text-xs text-muted-foreground">{studyNext.reason}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/chat?topic=${studyNext.slug}`}
            className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
          >
            Socratic Tutor &rarr;
          </Link>
          <Link
            href={`/quiz?slug=${studyNext.slug}`}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Practice Topic
          </Link>
        </div>
      </div>

      {/* Today's Adaptive Plan Queue */}
      <DashboardPlanQueue
        items={planItems}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />

      {/* 7-Day Simulation Slider */}
      <DashboardSimulator demoDay={demoDay} onDayChange={setDemoDay} />
    </div>
  );
}
