"use client";

import * as React from "react";
import Link from "next/link";
import {
  Brain,
  Clock,
  Zap,
  RefreshCw,
  Sparkles,
  Award,
  CalendarCheck,
  CheckCircle2,
  Sliders,
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

interface PlanItem {
  id: string;
  type: "review" | "micro_lesson" | "practice" | "reflect";
  topicId: string | null;
  conceptName: string;
  conceptSlug: string;
  estMinutes: number;
  status: "pending" | "completed" | "skipped";
  reason: string;
}

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

interface ProfileInsights {
  adaptationSummary: string;
  traits: {
    depthDescription: string;
    styleDescription: string;
    paceDescription: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [planItems, setPlanItems] = React.useState<PlanItem[]>([]);
  const [insights, setInsights] = React.useState<ProfileInsights | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Time-travel demo slider state (Day 1 to Day 7)
  const [demoDay, setDemoDay] = React.useState<number>(7);

  const fetchDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, planRes, insightsRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/plan/today"),
        fetch("/api/profile/insights"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setData(d);
      } else {
        // Fallback demo data
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
              state: "mastered",
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
              topicSlug: "sliding-window",
              topicName: "Sliding Window",
              difficultyLevel: 2,
              masteryScore: 0.55,
              retentionProbability: 0.45,
              effectiveMastery: 0.25,
              halfLifeDays: 1.8,
              attemptsCount: 4,
              state: "in_progress",
              misconceptions: { "shrink-condition": 2 },
            },
          ],
          reviewQueue: [
            {
              topicId: "3",
              topicSlug: "sliding-window",
              topicName: "Sliding Window",
              retentionProbability: 0.45,
              masteryScore: 0.55,
            },
          ],
          weakTopics: [
            {
              topicId: "3",
              topicSlug: "sliding-window",
              topicName: "Sliding Window",
              effectiveMastery: 0.25,
              attemptsCount: 4,
            },
          ],
          misconceptionCounts: {
            "pointer-boundary": 2,
            "shrink-condition": 2,
            "off-by-one": 1,
          },
          scoreTrendSeries: [
            { window: 1, accuracy: 60 },
            { window: 2, accuracy: 75 },
            { window: 3, accuracy: 82 },
          ],
          studyNext: {
            slug: "sliding-window",
            name: "Sliding Window",
            reason: "Retention dropped to 45% — spaced recall due",
          },
        });
      }

      if (planRes.ok) {
        const p = await planRes.json();
        setPlanItems(p.items || []);
      } else {
        // Fallback default plan
        setPlanItems([
          {
            id: "demo-1",
            type: "review",
            topicId: null,
            conceptName: "Sliding Window",
            conceptSlug: "sliding-window",
            estMinutes: 5,
            status: "pending",
            reason: "Retention calculated at 45%. Spaced recall keeps this durable.",
          },
          {
            id: "demo-2",
            type: "practice",
            topicId: null,
            conceptName: "Two Pointers",
            conceptSlug: "two-pointers",
            estMinutes: 7,
            status: "pending",
            reason: "Active developing area. Targeted practice solidifies boundary cases.",
          },
          {
            id: "demo-3",
            type: "micro_lesson",
            topicId: null,
            conceptName: "Linked Lists",
            conceptSlug: "linked-lists",
            estMinutes: 6,
            status: "pending",
            reason: "Next conceptual milestone in your curriculum path.",
          },
        ]);
      }

      if (insightsRes.ok) {
        const ins = await insightsRes.json();
        setInsights(ins);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCompletePlanItem = async (itemId: string) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "completed" } : item))
    );
    try {
      await fetch(`/api/plan/items/${itemId}/complete`, { method: "POST" });
    } catch {
      // Ignored
    }
  };

  const handleSkipPlanItem = async (itemId: string) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "skipped" } : item))
    );
    try {
      await fetch(`/api/plan/items/${itemId}/skip`, { method: "POST" });
    } catch {
      // Ignored
    }
  };

  if (loading) {
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-20 md:pb-8">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarCheck className="h-7 w-7 text-primary" />
            <span>Today&apos;s Plan & Progress</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Personalized daily learning path calibrated by cognitive state & Ebbinghaus retention
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
            <span>Quick Practice</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* ── SECTION 1: TODAY'S ADAPTIVE PLAN ─────────────────────────────── */}
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
              Today&apos;s Targeted Tasks ({planItems.filter((i) => i.status !== "completed").length} remaining)
            </h2>
          </div>
          <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary w-fit">
            Est. Time: {planItems.filter((i) => i.status === "pending").reduce((a, b) => a + b.estMinutes, 0)} mins
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planItems.map((item) => {
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
                          onClick={() => handleCompletePlanItem(item.id)}
                          className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent transition"
                          title="Mark complete"
                        >
                          Done
                        </button>
                        <button
                          onClick={() => handleSkipPlanItem(item.id)}
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

      {/* ── SECTION 2: DEMO TIME-TRAVEL SIMULATION SLIDER ────────────────── */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 p-6 sm:p-7 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                Interactive Demonstration
              </span>
            </div>
            <h3 className="font-bold text-base text-foreground">
              7-Day Learner Model Time-Travel Simulator
            </h3>
            <p className="text-xs text-muted-foreground">
              Scrub the timeline to witness how Elo mastery, retention half-life, and daily tasks evolve day-by-day.
            </p>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-center">
            <span className="text-[10px] uppercase font-bold text-indigo-500 block">Current Day</span>
            <span className="font-black text-lg text-foreground">Day {demoDay} of 7</span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={demoDay}
            onChange={(e) => setDemoDay(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer h-2 bg-muted rounded-lg"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
            <span>Day 1 (Diagnostic)</span>
            <span>Day 3 (Sliding Window Trap)</span>
            <span>Day 5 (Binary Search)</span>
            <span>Day 7 (Today&apos;s Review)</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: KPI OVERVIEW ───────────────────────────────────────── */}
      <div id="progress" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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

      {/* ── SECTION 4: HOW LEARN-AI ADAPTS TO YOU ─────────────────────────── */}
      {insights && (
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
      )}

      {/* ── SECTION 5: CHARTS & CURVES ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
          <h3 className="font-bold text-sm text-foreground">
            Top Concepts: Mastery vs. Retention Probability
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="mastery" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Elo Mastery %" />
                <Bar dataKey="retention" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Retention Prob %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
          <h3 className="font-bold text-sm text-foreground">
            Rolling Assessment Accuracy Trend
          </h3>
          <div className="h-64 w-full">
            {data?.scoreTrendSeries && data.scoreTrendSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.scoreTrendSeries} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="window" tick={{ fontSize: 10 }} />
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
                Take at least 5 questions to generate rolling trend lines.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 6: CURRICULUM TOPIC MASTERY GRID ──────────────────────── */}
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
                  <Link href={`/chat?topic=${t.topicSlug}`} className="text-primary hover:underline">
                    Discuss
                  </Link>
                  <Link href={`/quiz?slug=${t.topicSlug}`} className="text-muted-foreground hover:text-foreground font-medium">
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
