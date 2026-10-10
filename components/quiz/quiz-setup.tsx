"use client";

import { Zap, Sparkles, Clock, HelpCircle, MessageSquare, ArrowRight, WifiOff, RefreshCw } from "lucide-react";
import { CURATED_TOPICS } from "@/lib/learner/topics";
import type { QuizMode } from "./quiz-types";

interface QuizSetupProps {
  selectedMode: QuizMode;
  onSelectMode: (mode: QuizMode) => void;
  selectedTopicSlug: string;
  onSelectTopicSlug: (slug: string) => void;
  urlConversationId?: string;
  onStartQuiz: () => void;
  loading: boolean;
  errorMsg: string | null;
  pendingCount: number;
  syncing: boolean;
  onSyncOffline: () => void;
}

export function QuizSetup({
  selectedMode,
  onSelectMode,
  selectedTopicSlug,
  onSelectTopicSlug,
  urlConversationId,
  onStartQuiz,
  loading,
  errorMsg,
  pendingCount,
  syncing,
  onSyncOffline,
}: QuizSetupProps) {
  return (
    <div className="space-y-8">
      {pendingCount > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between text-xs text-foreground">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              You have <strong>{pendingCount}</strong> quiz answer{pendingCount > 1 ? "s" : ""} saved offline.
            </span>
          </div>
          <button
            onClick={onSyncOffline}
            disabled={syncing}
            className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Now"}</span>
          </button>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 text-white shadow-lg shadow-blue-500/25 mb-2">
          <Zap className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Dynamic Socratic Assessment
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Calibrated quizzes generated from curriculum topics or directly from your tutor chats.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Assessment Mode
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onSelectMode("chat")}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedMode === "chat"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="h-4 w-4 text-indigo-500" />
                <span className="font-bold text-sm text-foreground">Chat Context</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Targeted 3 questions drawn directly from your recent dialogue.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode("diagnostic")}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedMode === "diagnostic"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm text-foreground">Diagnostic</span>
              </div>
              <p className="text-xs text-muted-foreground">
                6–8 questions across fundamental CS concepts to benchmark.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode("recommended")}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedMode === "recommended"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm text-foreground">Recommended</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Targets lowest retention topics due for spaced repetition.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSelectMode("topic")}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedMode === "topic"
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/50 hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-sm text-foreground">Topic Focus</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Target any algorithm topic from the curriculum tracks.
              </p>
            </button>
          </div>
        </div>

        {selectedMode === "chat" && urlConversationId && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-foreground">
            <span className="font-semibold text-indigo-500 block mb-0.5">
              Connected to Chat Session
            </span>
            <span className="text-muted-foreground">
              Questions will be synthesized around the concept and edge cases discussed in your chat.
            </span>
          </div>
        )}

        {selectedMode === "topic" && (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <label className="text-xs font-semibold text-muted-foreground">
              Select Curriculum Concept
            </label>
            <select
              value={selectedTopicSlug}
              onChange={(e) => onSelectTopicSlug(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CURATED_TOPICS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} (Difficulty Level {t.difficultyLevel})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={onStartQuiz}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Generating Calibrated Questions...</span>
            </>
          ) : (
            <>
              <span>
                {selectedMode === "chat" ? "Start Chat Quiz (3 Questions)" : "Start Assessment"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
