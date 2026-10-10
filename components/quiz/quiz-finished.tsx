"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, AlertTriangle, Brain, Filter, Check, Plus, CheckCircle2, XCircle } from "lucide-react";
import type { FinishResult, QuizMeta } from "./quiz-types";

interface QuizFinishedProps {
  finishResult: FinishResult;
  quizMeta: QuizMeta | null;
  onReset: () => void;
  onAddToPlan: (id: string, name: string, reason: string) => void;
  addedPlanIds: Record<string, boolean>;
  addingPlanId: string | null;
}

export function QuizFinished({
  finishResult,
  quizMeta,
  onReset,
  onAddToPlan,
  addedPlanIds,
  addingPlanId,
}: QuizFinishedProps) {
  const [reviewFilter, setReviewFilter] = React.useState<"all" | "mistakes">("all");

  const filteredReview = React.useMemo(() => {
    if (reviewFilter === "mistakes") {
      return finishResult.questionReview.filter((qr) => !qr.isCorrect);
    }
    return finishResult.questionReview;
  }, [finishResult.questionReview, reviewFilter]);

  const mistakesCount = finishResult.questionReview.filter((qr) => !qr.isCorrect).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Score Card */}
      <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-10 text-center space-y-5 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 text-white shadow-xl shadow-blue-500/30">
          <span className="text-2xl font-black">{finishResult.accuracy}%</span>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">Assessment Complete</h2>
          <p className="text-sm text-muted-foreground">
            You answered {finishResult.score} of {finishResult.totalQuestions} questions correctly.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Take Another Quiz</span>
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Misconceptions Remediation Card */}
      {finishResult.misconceptions.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-sm text-foreground">
              Detected Misconception Tags ({finishResult.misconceptions.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Our cognitive evaluator detected specific error patterns in your choices:
          </p>
          <div className="flex flex-wrap gap-2">
            {finishResult.misconceptions.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              href={`/chat?topic=${quizMeta?.topicSlug || ""}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Discuss these misconceptions with Socratic Tutor &rarr;</span>
            </Link>
            <button
              onClick={() =>
                onAddToPlan(
                  "misconceptions-all",
                  quizMeta?.topicName || "Misconception Repair",
                  `Target misconceptions: ${finishResult.misconceptions.join(", ")}`
                )
              }
              disabled={addedPlanIds["misconceptions-all"] || addingPlanId === "misconceptions-all"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition disabled:opacity-50"
            >
              {addedPlanIds["misconceptions-all"] ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Added to Plan!</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>Add remediation to Today&apos;s Plan</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Per-Question Review List with Filter */}
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span>Question Review ({finishResult.totalQuestions})</span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReviewFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                reviewFilter === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({finishResult.totalQuestions})
            </button>
            <button
              type="button"
              onClick={() => setReviewFilter("mistakes")}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                reviewFilter === "mistakes"
                  ? "bg-rose-500 text-white font-semibold"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Mistakes Only ({mistakesCount})
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredReview.map((item, idx) => (
            <div
              key={item.questionId || idx}
              className={`rounded-xl border p-4 transition ${
                item.isCorrect
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {item.isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-relaxed">
                      {item.questionText}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      {item.topicName || quizMeta?.topicName} • Choice: {String.fromCharCode(65 + item.selectedIndex)}
                    </span>
                  </div>
                </div>

                {!item.isCorrect && (
                  <button
                    onClick={() =>
                      onAddToPlan(
                        item.questionId,
                        item.topicName || "Targeted Concept Review",
                        `Reinforce concept from missed quiz question: ${item.questionText.slice(0, 70)}...`
                      )
                    }
                    disabled={addedPlanIds[item.questionId] || addingPlanId === item.questionId}
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition disabled:opacity-50"
                  >
                    {addedPlanIds[item.questionId] ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>In Plan</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3 text-primary" />
                        <span>Add to Plan</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
