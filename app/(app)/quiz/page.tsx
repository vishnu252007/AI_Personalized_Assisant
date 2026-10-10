"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { QuizSetup } from "@/components/quiz/quiz-setup";
import { QuizActive } from "@/components/quiz/quiz-active";
import { QuizFinished } from "@/components/quiz/quiz-finished";
import { useQuiz } from "@/components/quiz/use-quiz";
import type { QuizMode } from "@/components/quiz/quiz-types";

function QuizContent() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode");
  const urlSlug = searchParams.get("slug") || "";
  const urlConversationId = searchParams.get("conversationId") || "";
  const urlConcept = searchParams.get("concept") || "";

  const initialMode: QuizMode =
    urlMode === "chat" || urlConversationId
      ? "chat"
      : urlMode === "diagnostic"
      ? "diagnostic"
      : urlSlug
      ? "topic"
      : "recommended";

  const {
    phase,
    selectedMode,
    setSelectedMode,
    selectedTopicSlug,
    setSelectedTopicSlug,
    loading,
    errorMsg,
    pendingCount,
    syncing,
    quizMeta,
    questions,
    currentIndex,
    selectedOption,
    answerResult,
    finishResult,
    addedPlanIds,
    addingPlanId,
    startQuiz,
    handleSelectOption,
    handleNextQuestion,
    handleAddToPlan,
    resetQuiz,
    handleSyncOffline,
  } = useQuiz(initialMode, urlSlug || "arrays-and-hashing", urlConversationId, urlConcept);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 pb-20 md:pb-8">
      {phase === "setup" && (
        <QuizSetup
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          selectedTopicSlug={selectedTopicSlug}
          onSelectTopicSlug={setSelectedTopicSlug}
          urlConversationId={urlConversationId}
          onStartQuiz={startQuiz}
          loading={loading}
          errorMsg={errorMsg}
          pendingCount={pendingCount}
          syncing={syncing}
          onSyncOffline={handleSyncOffline}
        />
      )}
      {phase === "active" && (
        <QuizActive
          quizMeta={quizMeta}
          questions={questions}
          currentIndex={currentIndex}
          selectedOption={selectedOption}
          answerResult={answerResult}
          onSelectOption={handleSelectOption}
          onNextQuestion={handleNextQuestion}
          onAbandon={resetQuiz}
        />
      )}
      {phase === "finished" && finishResult && (
        <QuizFinished
          finishResult={finishResult}
          quizMeta={quizMeta}
          onReset={resetQuiz}
          onAddToPlan={handleAddToPlan}
          addedPlanIds={addedPlanIds}
          addingPlanId={addingPlanId}
        />
      )}
    </div>
  );
}

export default function QuizPage() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center text-xs text-muted-foreground">Loading practice quiz...</div>}>
      <QuizContent />
    </React.Suspense>
  );
}
