"use client";

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

interface TopicMetric {
  topicName: string;
  masteryScore: number;
  effectiveMastery: number;
  retentionProbability: number;
}

interface ScoreTrendItem {
  window: number;
  accuracy: number;
}

interface DashboardChartsProps {
  topicMetrics: TopicMetric[];
  scoreTrendSeries: ScoreTrendItem[];
}

export function DashboardCharts({
  topicMetrics,
  scoreTrendSeries,
}: DashboardChartsProps) {
  const chartData = (topicMetrics || []).slice(0, 7).map((t) => ({
    name: t.topicName.length > 14 ? t.topicName.slice(0, 12) + "…" : t.topicName,
    mastery: Math.round(t.masteryScore * 100),
    effective: Math.round(t.effectiveMastery * 100),
    retention: Math.round(t.retentionProbability * 100),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart: Mastery vs. Retention */}
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

      {/* Line Chart: Accuracy Trend */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <h3 className="font-bold text-sm text-foreground">
          Rolling Assessment Accuracy Trend
        </h3>
        <div className="h-64 w-full">
          {scoreTrendSeries && scoreTrendSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrendSeries} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
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
  );
}
