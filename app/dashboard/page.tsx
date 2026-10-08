"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Brain,
  Clock,
  AlertTriangle,
  Zap,
  ArrowRight,
  RefreshCw,
  BookOpen,
  Sparkles,
  Award,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DashboardData {
  summary: {
    trackedTopics: number;
    assessmentAccuracy: number;
    totalAttempts: number;
    reviewQueueCount: number;
  };
  topicMetrics: Array<{
    topicId: string;
    topicSlug: string;
    topicName: string;
    difficultyLevel: number;
    masteryScore: number;
    retentionProbability: number;
    effectiveMastery: number;
    halfLifeDays: number;
    attemptsCount: number;
    state: "not_started" | "in_progress" | "mastered";
    misconceptions: Record<string, number>;
  }>;
  reviewQueue: Array<{
    topicId: string;
    topicSlug: string;
    topicName: string;
    retentionProbability: number;
    masteryScore: number;
  }>;
  weakTopics: Array<{
    topicId: string;
    topicSlug: string;
    topicName: string;
    effectiveMastery: number;
    attemptsCount: number;
  }>;
  misconceptionCounts: Record<string, number>;
  scoreTrendSeries: Array<{ window: number; accuracy: number }>;
  studyNext: {
    slug: string;
    name: string;
    reason: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        // Unauthenticated demo fallback view
        setData({
          summary: {
            trackedTopics: 14,
            assessmentAccuracy: 78,
            totalAttempts: 24,
            reviewQueueCount: 2,
          },
          topicMetrics: [
            {
              topicId: "1",
              topicSlug: "arrays-and-hashing",
              topicName: "Arrays & Hashing",
              difficultyLevel: 1,
              masteryScore: 0.85,
              retentionProbability: 0.92,
              effectiveMastery: 0.78,
              halfLifeDays: 8.5,
              attemptsCount: 8,
              state: "in_progress",
              misconceptions: { "off-by-one": 1 },
            },
            {
              topicId: "2",
              topicSlug: "two-pointers",
              topicName: "Two Pointers",
              difficultyLevel: 2,
              masteryScore: 0.7,
              retentionProbability: 0.65,
              effectiveMastery: 0.45,
              halfLifeDays: 3.2,
              attemptsCount: 6,
              state: "in_progress",
              misconceptions: { "pointer-boundary": 2 },
            },
            {
              topicId: "3",
              topicSlug: "binary-search",
              topicName: "Binary Search",
              difficultyLevel: 2,
              masteryScore: 0.6,
              retentionProbability: 0.58,
              effectiveMastery: 0.35,
              halfLifeDays: 2.1,
              attemptsCount: 5,
              state: "in_progress",
              misconceptions: { "midpoint-overflow": 2, "boundary-condition": 1 },
            },
          ],
          reviewQueue: [
            {
              topicId: "3",
              topicSlug: "binary-search",
              topicName: "Binary Search",
              retentionProbability: 0.58,
              masteryScore: 0.6,
            },
            {
              topicId: "2",
              topicSlug: "two-pointers",
              topicName: "Two Pointers",
              retentionProbability: 0.65,
              masteryScore: 0.7,
            },
          ],
          weakTopics: [
            {
              topicId: "3",
              topicSlug: "binary-search",
              topicName: "Binary Search",
              effectiveMastery: 0.35,
              attemptsCount: 5,
            },
          ],
          misconceptionCounts: {
            "pointer-boundary": 2,
            "midpoint-overflow": 2,
            "boundary-condition": 1,
            "off-by-one": 1,
          },
          scoreTrendSeries: [
            { window: 1, accuracy: 60 },
            { window: 2, accuracy: 80 },
          ],
          studyNext: {
            slug: "binary-search",
            name: "Binary Search",
            reason: "Memory retention below 80% — due for review",
          },
        });
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load dashboard metrics");
      }

      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Calculating cognitive retention metrics...</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    trackedTopics: 0,
    assessmentAccuracy: 0,
    totalAttempts: 0,
    reviewQueueCount: 0,
  };

  const chartData = (data?.topicMetrics || []).slice(0, 7).map((t) => ({
    name: t.topicName.length > 14 ? t.topicName.slice(0, 12) + "…" : t.topicName,
    mastery: Math.round(t.masteryScore * 100),
    effective: Math.round(t.effectiveMastery * 100),
    retention: Math.round(t.retentionProbability * 100),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="h-7 w-7 text-primary" />
            <span>Learner Cognitive Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time Elo mastery modeling, Ebbinghaus forgetting curves, and Bayesian style feedback
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
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
            <span>New Quiz</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Recommended "Study Next" Banner */}
      {data?.studyNext && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 p-5 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Smart Recommendation
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {data.studyNext.name}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {data.studyNext.reason}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/chat?topic=${data.studyNext.slug}`}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
            >
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span>Discuss with Socratic Tutor</span>
            </Link>
            <Link
              href={`/quiz?slug=${data.studyNext.slug}`}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Take Topic Quiz</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
            <Award className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {summary.assessmentAccuracy}%
          </p>
          <p className="text-[11px] text-muted-foreground">
            Across {summary.totalAttempts} total attempts
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Review Queue</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {summary.reviewQueueCount}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Topics with retention &lt; 80%
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Tracked Topics</span>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {summary.trackedTopics}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Active curated concepts
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Misconceptions</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {Object.keys(data?.misconceptionCounts || {}).length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Patterns flagged for remediation
          </p>
        </div>
      </div>

      {/* Review Queue & Spaced Repetition Priority */}
      {data?.reviewQueue && data.reviewQueue.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-sm text-foreground">
                Spaced Repetition Review Queue ({data.reviewQueue.length})
              </h3>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Sorted by lowest retention first
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.reviewQueue.map((item) => (
              <div
                key={item.topicId}
                className="rounded-xl border border-border bg-background/80 p-3.5 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-xs text-foreground truncate max-w-[170px]">
                    {item.topicName}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-500">
                    {Math.round(item.retentionProbability * 100)}% Ret.
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${Math.round(item.retentionProbability * 100)}%` }}
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Link
                    href={`/quiz?slug=${item.topicSlug}`}
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Quick Recall Quiz</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Mastery vs Effective Mastery */}
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Mastery vs. Effective Retention
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Blue = Elo Mastery, Purple = Effective Mastery (Mastery × Retention)
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="mastery" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Mastery %" />
                <Bar dataKey="effective" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Effective %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Trend Accuracy Series */}
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">
              Performance Trend (Windows of 10)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Rolling window accuracy over successive evaluation attempts
            </p>
          </div>

          <div className="h-64 w-full">
            {data?.scoreTrendSeries && data.scoreTrendSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.scoreTrendSeries}
                  margin={{ top: 10, right: 20, left: -20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="window" tick={{ fontSize: 10 }} label={{ value: "Window", position: "insideBottom", offset: -5, fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#10b981" }}
                    name="Accuracy %"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Take at least 10 quiz questions to generate rolling trend lines.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Misconceptions Breakdown */}
      {data?.misconceptionCounts && Object.keys(data.misconceptionCounts).length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span>Active Misconception Signals</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Patterns extracted from incorrect options chosen during quizzes and confusion detected in Socratic chat:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(data.misconceptionCounts).map(([tag, count]) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-400"
              >
                <span>{tag}</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {count}x
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Curated Topic Metrics Table / Grid */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <h3 className="font-bold text-sm text-foreground">
          Curriculum Topic Mastery & Retention Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.topicMetrics || []).map((t) => {
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
                  <Link
                    href={`/chat?topic=${t.topicSlug}`}
                    className="text-primary hover:underline"
                  >
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
    </div>
  );
}
