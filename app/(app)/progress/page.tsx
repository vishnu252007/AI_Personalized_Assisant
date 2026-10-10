"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { TrendingUp, RefreshCw, Zap } from "lucide-react";
import { useOverviewQuery } from "@/lib/hooks/use-learn-query";
import { ProgressKPIs } from "@/components/dashboard/progress-kpis";
import { ProgressInsights } from "@/components/dashboard/progress-insights";
import { TopicMasteryGrid } from "@/components/dashboard/topic-mastery-grid";
import { DashboardChartsSkeleton } from "@/components/dashboard/dashboard-charts-skeleton";

const LazyDashboardCharts = dynamic(
  () =>
    import("@/components/dashboard/dashboard-charts").then(
      (mod) => mod.DashboardCharts
    ),
  {
    ssr: false,
    loading: () => <DashboardChartsSkeleton />,
  }
);

export default function ProgressPage() {
  const { data: overview, isLoading, error, refetch } = useOverviewQuery();

  if (isLoading && !overview) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">
            Loading mastery curves and analytics...
          </span>
        </div>
      </div>
    );
  }

  const summary = overview?.dashboard?.summary || {
    trackedTopics: 0,
    assessmentAccuracy: 0,
    totalAttempts: 0,
    reviewQueueCount: 0,
  };

  const topicMetrics = overview?.dashboard?.topicMetrics || [];
  const scoreTrendSeries = overview?.dashboard?.scoreTrendSeries || [];
  const insights = overview?.insights;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="h-7 w-7 text-emerald-500" />
            <span>Progress & Analytics</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time Elo mastery tracking, Bayesian cognitive adaptation, and retention decay
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
            href="/quiz?mode=diagnostic"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Diagnostic Quiz</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          Error syncing latest analytics. Displaying cached session state.
        </div>
      )}

      {/* KPI Overview */}
      <ProgressKPIs summary={summary} />

      {/* Learner Profile Transparency */}
      {insights && <ProgressInsights insights={insights} />}

      {/* Dynamic Recharts Visualization */}
      <LazyDashboardCharts
        topicMetrics={topicMetrics}
        scoreTrendSeries={scoreTrendSeries}
      />

      {/* Curriculum Mastery Grid */}
      <TopicMasteryGrid topics={topicMetrics} />
    </div>
  );
}
