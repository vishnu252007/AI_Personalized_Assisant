"use client";

import * as React from "react";
import Link from "next/link";
import {
  Brain,
  Sparkles,
  ArrowRight,
  Lightbulb,
  ListOrdered,
  Code2,
  Clock,
  TrendingUp,
  ShieldCheck,
  Zap,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { CURATED_TOPICS } from "@/lib/learner/topics";

export default function HomePage() {
  const [selectedStyle, setSelectedStyle] = React.useState<"analogy" | "steps" | "example">("analogy");

  const styleSamples = {
    analogy: {
      title: "Conceptual Analogy",
      badge: "Intuitive Framing",
      icon: Lightbulb,
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-500",
      content:
        "Think of binary search like searching for a word in a 1,000-page dictionary: instead of flipping every single page from page 1, you open right to page 500. If your word starts with 'S', you discard pages 1–499 forever. What would happen if the dictionary pages were shuffled?",
    },
    steps: {
      title: "First-Principles Steps",
      badge: "Algorithmic Precision",
      icon: ListOrdered,
      color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-500",
      content:
        "1. Define low = 0 and high = len - 1.\n2. In each iteration, calculate mid = low + ((high - low) >> 1) to prevent integer overflow.\n3. Compare target with arr[mid].\n4. If target < arr[mid], contract search space by setting high = mid - 1.\nWhy is the shift operator preferred over (low + high) / 2 in production runtimes?",
    },
    example: {
      title: "Real-World Code & Edge Cases",
      badge: "Executable Context",
      icon: Code2,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-500",
      content:
        "Suppose we have timestamps [100, 150, 200, 250, 300] and we need the first event >= 180. A regular match fails because 180 is not present. How would our condition high = mid vs low = mid + 1 behave when finding the lower-bound index?",
    },
  };

  return (
    <div className="relative overflow-hidden pb-16 pt-8 sm:pt-12">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-full max-w-7xl -translate-x-1/2 bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent blur-3xl dark:from-blue-600/15" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20 sm:space-y-28">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Dual Model Socratic Intelligence • Gemini 3.5 & Groq LLaMA</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
            The AI Tutor That{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400">
              Adapts To How Your Brain Thinks
            </span>
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground leading-relaxed">
            Stop passively reading tutorials. LearnAI evaluates your misconceptions in real-time,
            dynamically adjusts its pedagogical style with Bayesian Thompson Sampling, and schedules reviews
            before forgetting sets in.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 hover:scale-[1.02]"
            >
              <Brain className="h-4 w-4" />
              <span>Start Socratic Dialogue</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/quiz"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent hover:border-primary/40"
            >
              <Zap className="h-4 w-4 text-primary" />
              <span>Diagnostic Assessment</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl border border-border bg-card/30 px-5 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground hover:bg-accent/50"
            >
              <TrendingUp className="h-4 w-4" />
              <span>View Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Interactive Feature Demo: Pedagogical Adaptation Preview */}
        <div className="rounded-3xl border border-border/80 bg-card/50 p-6 sm:p-10 shadow-2xl backdrop-blur-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Multi-Armed Bandit Demonstration
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Bayesian Thompson Sampling in Action
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Select a teaching modality below to see how the Socratic tutor reformulates binary search
              </p>
            </div>

            {/* Style Selector Tabs */}
            <div className="flex rounded-xl bg-background/80 p-1 border border-border">
              {(["analogy", "steps", "example"] as const).map((styleKey) => {
                const sample = styleSamples[styleKey];
                const Icon = sample.icon;
                const isSelected = selectedStyle === styleKey;
                return (
                  <button
                    key={styleKey}
                    onClick={() => setSelectedStyle(styleKey)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="capitalize">{styleKey}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Style Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-[11px] font-semibold text-primary">
                  {styleSamples[selectedStyle].badge}
                </span>
                <span className="text-xs text-muted-foreground">Prompt reformulation</span>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-5 font-mono text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-line shadow-inner">
                {styleSamples[selectedStyle].content}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-accent/20 p-5 space-y-4">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                <span>Bayesian Adaptation Math</span>
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every interaction updates parameters $\alpha$ and $\beta$ via Beta distribution conjugate priors:
              </p>
              <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Correct Answer:</span>
                  <span className="font-mono text-emerald-500 font-semibold">&alpha; &larr; &alpha; + 1.0</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Wrong Answer:</span>
                  <span className="font-mono text-rose-500 font-semibold">&beta; &larr; &beta; + 1.0</span>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/40">
                  <span>Sampling:</span>
                  <span className="font-mono text-primary font-semibold">&theta; &sim; Beta(&alpha;, &beta;)</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                The style with the highest sampled probability is automatically selected for your next topic explanation.
              </p>
            </div>
          </div>
        </div>

        {/* Cognitive Engine Architecture Pillars */}
        <div className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Core Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Four Interlocking Learning Systems
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 shadow-md hover:border-primary/40 transition">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Brain className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Socratic Dialogue</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The tutor never gives answers directly. It guides you with counter-questions, scaffolds analogies, and detects confusion signals in real-time.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 shadow-md hover:border-primary/40 transition">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Elo Dynamic Mastery</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Continuous mastery score $M \in [0, 1]$ scaled with logistic curves and dynamic $K$-factors: quizzes weight 3x heavier than chat observations.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 shadow-md hover:border-primary/40 transition">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Spaced Repetition</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ebbinghaus forgetting curve modeling R = 2^(-&Delta;t / S). Half-life S expands upon active recall and contracts upon memory failure.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 shadow-md hover:border-primary/40 transition">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-foreground">Strict Privacy & Zero Leak</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Answer keys never reach client bundles. Derived states are updated only by server admin authority. Full GDPR one-click account purge available.
              </p>
            </div>
          </div>
        </div>

        {/* 14 Curated Topics Curriculum Explorer */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Curriculum
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                14 Fine-Grained Algorithms Topics
              </h2>
            </div>
            <Link
              href="/quiz?mode=diagnostic"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>Take 7-Question Diagnostic</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {CURATED_TOPICS.map((topic) => (
              <div
                key={topic.slug}
                className="rounded-2xl border border-border bg-card/50 p-4 space-y-2 hover:border-primary/40 hover:bg-card/80 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground truncate max-w-[170px]">
                    {topic.name}
                  </span>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Level {topic.difficultyLevel}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/chat?topic=${topic.slug}`}
                    className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <BookOpen className="h-3 w-3" />
                    <span>Study</span>
                  </Link>
                  <Link
                    href={`/quiz?slug=${topic.slug}`}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <Zap className="h-3 w-3" />
                    <span>Quiz</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
