"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Brain,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { CURATED_TOPICS } from "@/lib/learner/topics";

interface QuestionItem {
  id: string;
  questionText: string;
  options: string[];
  difficulty: number;
  orderIndex: number;
}

interface QuizMeta {
  id: string;
  topicSlug: string;
  topicName: string;
  difficultyLevel: number;
  totalQuestions: number;
}

interface AnswerResult {
  correct: boolean;
  correctIndex: number;
  chosenExplanation: string;
  correctExplanation: string;
}

interface FinishResult {
  score: number;
  totalQuestions: number;
  accuracy: number;
  weakTopics: string[];
  misconceptions: string[];
  questionReview: Array<{
    questionId: string;
    questionText: string;
    isCorrect: boolean;
    selectedIndex: number;
    topicName: string | null;
  }>;
}

function QuizContent() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode");
  const urlSlug = searchParams.get("slug") || "";

  // Quiz state
  const [phase, setPhase] = React.useState<"setup" | "active" | "finished">("setup");
  const [selectedMode, setSelectedMode] = React.useState<"diagnostic" | "topic" | "recommended">(
    urlMode === "diagnostic" ? "diagnostic" : urlSlug ? "topic" : "recommended"
  );
  const [selectedTopicSlug, setSelectedTopicSlug] = React.useState<string>(urlSlug || "arrays-and-hashing");

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Active quiz state
  const [quizMeta, setQuizMeta] = React.useState<QuizMeta | null>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [answerResult, setAnswerResult] = React.useState<AnswerResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = React.useState<number>(Date.now());
  const [submittingAnswer, setSubmittingAnswer] = React.useState(false);

  // Finish state
  const [finishResult, setFinishResult] = React.useState<FinishResult | null>(null);

  const startQuiz = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          topicSlug: selectedMode === "topic" ? selectedTopicSlug : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to generate quiz. Please ensure you are signed in.");
      }

      const json = await res.json();
      setQuizMeta(json.quiz);
      setQuestions(json.questions || []);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerResult(null);
      setQuestionStartTime(Date.now());
      setPhase("active");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (optionIndex: number) => {
    if (selectedOption !== null || submittingAnswer || !quizMeta) return;

    setSelectedOption(optionIndex);
    setSubmittingAnswer(true);
    const latencyMs = Math.max(0, Date.now() - questionStartTime);

    try {
      const currentQ = questions[currentIndex];
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quizMeta.id,
          questionId: currentQ.id,
          chosenIndex: optionIndex,
          timeMs: latencyMs,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit answer");
      }

      const evalData = await res.json();
      setAnswerResult(evalData);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error evaluating answer");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleNextQuestion = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswerResult(null);
      setQuestionStartTime(Date.now());
    } else {
      // Complete quiz
      await finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!quizMeta) return;
    setLoading(true);
    try {
      const res = await fetch("/api/quiz/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quizMeta.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to finalize quiz evaluation");
      }

      const result = await res.json();
      setFinishResult(result);
      setPhase("finished");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to finish quiz");
    } finally {
      setLoading(false);
    }
  };

  const resetQuiz = () => {
    setPhase("setup");
    setQuizMeta(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswerResult(null);
    setFinishResult(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── PHASE 1: SETUP SCREEN ──────────────────────────────────────────────── */}
      {phase === "setup" && (
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 text-white shadow-lg shadow-blue-500/25 mb-2">
              <Zap className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Dynamic Socratic Assessment
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Diagnostic multi-concept quizzes and topic-specific recall challenges calibrated to your Elo mastery
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMode("diagnostic")}
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
                    6–8 questions across fundamental CS concepts to benchmark your profile.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("recommended")}
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
                    Automatically targets lowest retention topics due for spaced repetition review.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("topic")}
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
                    Target a single specific algorithm topic from the 14 curated curriculum tracks.
                  </p>
                </button>
              </div>
            </div>

            {selectedMode === "topic" && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-xs font-semibold text-muted-foreground">
                  Select Curriculum Concept
                </label>
                <select
                  value={selectedTopicSlug}
                  onChange={(e) => setSelectedTopicSlug(e.target.value)}
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
              onClick={startQuiz}
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
                  <span>Start Assessment</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE 2: ACTIVE QUESTION SCREEN ────────────────────────────────────── */}
      {phase === "active" && questions.length > 0 && (
        <div className="space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {quizMeta?.topicName} • Level {questions[currentIndex].difficulty}
              </span>
            </div>

            <button
              onClick={resetQuiz}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Abandon
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`,
              }}
            />
          </div>

          {/* Question Card */}
          <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
            <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
              {questions[currentIndex].questionText}
            </h2>

            {/* Options Grid */}
            <div className="grid grid-cols-1 gap-3">
              {questions[currentIndex].options.map((optionText, optIndex) => {
                const isChosen = selectedOption === optIndex;
                const isEvaluated = answerResult !== null;
                const isCorrect = isEvaluated && answerResult.correctIndex === optIndex;
                const isWrongChoice = isEvaluated && isChosen && !answerResult.correct;

                return (
                  <button
                    key={optIndex}
                    disabled={selectedOption !== null}
                    onClick={() => handleSelectOption(optIndex)}
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left text-sm transition ${
                      isCorrect
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                        : isWrongChoice
                        ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium"
                        : isChosen
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background/60 hover:bg-accent text-foreground"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs font-bold">
                      {String.fromCharCode(65 + optIndex)}
                    </span>
                    <span className="flex-1">{optionText}</span>
                    {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                    {isWrongChoice && <XCircle className="h-5 w-5 text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Answer Rationales Feedback Card */}
            {answerResult && (
              <div
                className={`rounded-2xl border p-5 space-y-3 animate-fade-in ${
                  answerResult.correct
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {answerResult.correct ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        Correct Answer!
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-rose-500" />
                      <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
                        Incorrect Choice
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-2 text-xs leading-relaxed text-foreground">
                  {!answerResult.correct && (
                    <div>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        Why choice {String.fromCharCode(65 + (selectedOption ?? 0))} is incorrect:{" "}
                      </span>
                      <span>{answerResult.chosenExplanation}</span>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Correct rationale (Option {String.fromCharCode(65 + answerResult.correctIndex)}):{" "}
                    </span>
                    <span>{answerResult.correctExplanation}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition"
                  >
                    <span>
                      {currentIndex + 1 < questions.length ? "Next Question" : "Complete & View Debrief"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PHASE 3: FINISH & DEBRIEF SCREEN ───────────────────────────────────── */}
      {phase === "finished" && finishResult && (
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
                onClick={resetQuiz}
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
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <h3 className="font-bold text-sm text-foreground">
                  Detected Misconception Tags ({finishResult.misconceptions.length})
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Our cognitive evaluator detected specific error patterns in your choices:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {finishResult.misconceptions.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="pt-2">
                <Link
                  href={`/chat?topic=${quizMeta?.topicSlug || ""}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>Discuss these misconceptions with Socratic Tutor &rarr;</span>
                </Link>
              </div>
            </div>
          )}

          {/* Per-Question Review List */}
          <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
            <h3 className="font-bold text-sm text-foreground">Detailed Question Review</h3>
            <div className="space-y-3">
              {finishResult.questionReview.map((qr, i) => (
                <div
                  key={qr.questionId}
                  className="rounded-xl border border-border/80 bg-background/50 p-4 flex items-start gap-3"
                >
                  {qr.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-foreground">
                      Q{i + 1}: {qr.questionText}
                    </span>
                    <div className="text-muted-foreground">
                      Selected: Option {String.fromCharCode(65 + qr.selectedIndex)} •{" "}
                      <span className={qr.isCorrect ? "text-emerald-500" : "text-rose-500"}>
                        {qr.isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground text-sm">
          Loading diagnostic quiz session...
        </div>
      }
    >
      <QuizContent />
    </React.Suspense>
  );
}

