"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, Lightbulb, Brain, ArrowRight } from "lucide-react";
import type { QuestionItem, QuizMeta, AnswerResult } from "./quiz-types";

interface QuizActiveProps {
  quizMeta: QuizMeta | null;
  questions: QuestionItem[];
  currentIndex: number;
  selectedOption: number | null;
  answerResult: AnswerResult | null;
  onSelectOption: (optIndex: number) => void;
  onNextQuestion: () => void;
  onAbandon: () => void;
}

export function QuizActive({
  quizMeta,
  questions,
  currentIndex,
  selectedOption,
  answerResult,
  onSelectOption,
  onNextQuestion,
  onAbandon,
}: QuizActiveProps) {
  const [explainAngle, setExplainAngle] = React.useState<"analogy" | "steps" | "pitfalls" | null>(null);

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {quizMeta?.topicName} • Level {currentQuestion.difficulty}
          </span>
        </div>

        <button
          onClick={onAbandon}
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
          {currentQuestion.questionText}
        </h2>

        {/* Options Grid */}
        <div className="grid grid-cols-1 gap-3">
          {currentQuestion.options.map((optionText, optIndex) => {
            const isChosen = selectedOption === optIndex;
            const isEvaluated = answerResult !== null;
            const isCorrect = isEvaluated && answerResult.correctIndex === optIndex;
            const isWrongChoice = isEvaluated && isChosen && !answerResult.correct;

            return (
              <button
                key={optIndex}
                disabled={selectedOption !== null}
                onClick={() => onSelectOption(optIndex)}
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
            className={`rounded-2xl border p-5 space-y-4 animate-fade-in ${
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
                    {answerResult.isOffline ? "Saved Offline" : "Correct Answer!"}
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
                  Rationale:{" "}
                </span>
                <span>{answerResult.correctExplanation}</span>
              </div>
            </div>

            {/* Alternate Angles Section */}
            <div className="pt-2 border-t border-border/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <span>Need a different perspective?</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExplainAngle(explainAngle === "analogy" ? null : "analogy")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition ${
                      explainAngle === "analogy"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/70 hover:bg-accent text-foreground"
                    }`}
                  >
                    Intuition / Analogy
                  </button>
                  <button
                    type="button"
                    onClick={() => setExplainAngle(explainAngle === "steps" ? null : "steps")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition ${
                      explainAngle === "steps"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/70 hover:bg-accent text-foreground"
                    }`}
                  >
                    Step-by-Step
                  </button>
                  <button
                    type="button"
                    onClick={() => setExplainAngle(explainAngle === "pitfalls" ? null : "pitfalls")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition ${
                      explainAngle === "pitfalls"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card/70 hover:bg-accent text-foreground"
                    }`}
                  >
                    Common Pitfall
                  </button>
                </div>
              </div>

              {explainAngle && (
                <div className="rounded-xl border border-primary/20 bg-card p-3.5 text-xs text-foreground space-y-2 animate-fade-in shadow-sm">
                  {explainAngle === "analogy" && (
                    <div>
                      <strong className="text-primary block mb-0.5">💡 Conceptual Analogy</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Think of this concept like an indexed directory: looking up by an exact address gives immediate access without flipping through every element sequentially.
                      </p>
                    </div>
                  )}
                  {explainAngle === "steps" && (
                    <div>
                      <strong className="text-primary block mb-0.5">🔬 Step-by-Step Execution</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        1. Check boundary conditions. 2. Apply loop invariant / recursion step. 3. Return evaluated outcome.
                      </p>
                    </div>
                  )}
                  {explainAngle === "pitfalls" && (
                    <div>
                      <strong className="text-primary block mb-0.5">⚠️ Pitfall Alert</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Learners commonly assume this runs in constant extra space or overlooks boundary edge cases. Always verify worst-case bounds.
                      </p>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Still stuck?</span>
                    <Link
                      href={`/chat?topic=${quizMeta?.topicSlug || ""}&prompt=${encodeURIComponent(
                        `Explain this quiz question in simple terms:\n"${currentQuestion.questionText}"\nCorrect Answer: "${currentQuestion.options[answerResult.correctIndex]}"`
                      )}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <Brain className="h-3 w-3" />
                      <span>Ask Socratic Tutor in Chat &rarr;</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onNextQuestion}
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
  );
}
