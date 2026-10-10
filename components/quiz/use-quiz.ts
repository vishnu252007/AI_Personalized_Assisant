"use client";

import * as React from "react";
import {
  saveOfflineQuiz,
  queueOfflineAnswer,
  getPendingAnswers,
  syncPendingAnswers,
} from "@/lib/offline/quiz-store";
import type {
  QuestionItem,
  QuizMeta,
  AnswerResult,
  FinishResult,
  QuizMode,
} from "./quiz-types";

export function useQuiz(
  initialMode: QuizMode,
  initialTopicSlug: string,
  urlConversationId?: string,
  urlConcept?: string
) {
  const [phase, setPhase] = React.useState<"setup" | "active" | "finished">("setup");
  const [selectedMode, setSelectedMode] = React.useState<QuizMode>(initialMode);
  const [selectedTopicSlug, setSelectedTopicSlug] = React.useState<string>(initialTopicSlug);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  const [quizMeta, setQuizMeta] = React.useState<QuizMeta | null>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [answerResult, setAnswerResult] = React.useState<AnswerResult | null>(null);
  const [questionStartTime, setQuestionStartTime] = React.useState<number>(Date.now());
  const [finishResult, setFinishResult] = React.useState<FinishResult | null>(null);
  const [addedPlanIds, setAddedPlanIds] = React.useState<Record<string, boolean>>({});
  const [addingPlanId, setAddingPlanId] = React.useState<string | null>(null);

  const refreshPendingCount = React.useCallback(() => {
    setPendingCount(getPendingAnswers().length);
  }, []);

  React.useEffect(() => {
    refreshPendingCount();
    window.addEventListener("online", refreshPendingCount);
    return () => window.removeEventListener("online", refreshPendingCount);
  }, [refreshPendingCount]);

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
          conversationId: selectedMode === "chat" ? urlConversationId || undefined : undefined,
          conceptName: selectedMode === "chat" ? urlConcept || undefined : undefined,
          count: selectedMode === "chat" ? 3 : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate quiz questions.");
      const data = await res.json();
      setQuizMeta(data.quiz);
      setQuestions(data.questions);
      saveOfflineQuiz({
        ...data.quiz,
        status: "in_progress",
        questions: data.questions,
        savedAt: Date.now(),
      });
      setPhase("active");
      setCurrentIndex(0);
      setQuestionStartTime(Date.now());
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error generating quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (optIndex: number) => {
    if (selectedOption !== null || !quizMeta) return;
    setSelectedOption(optIndex);
    const timeMs = Date.now() - questionStartTime;
    const currentQuestion = questions[currentIndex];
    try {
      const res = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quizMeta.id, questionId: currentQuestion.id, chosenIndex: optIndex, timeMs }),
      });
      if (res.ok) {
        setAnswerResult(await res.json());
      } else {
        queueOfflineAnswer({ quizId: quizMeta.id, questionId: currentQuestion.id, chosenIndex: optIndex, timeMs });
        refreshPendingCount();
        setAnswerResult({ correct: false, correctIndex: 0, chosenExplanation: "Saved offline.", correctExplanation: "Will sync online.", isOffline: true });
      }
    } catch {
      queueOfflineAnswer({ quizId: quizMeta.id, questionId: currentQuestion.id, chosenIndex: optIndex, timeMs });
      refreshPendingCount();
      setAnswerResult({ correct: false, correctIndex: 0, chosenExplanation: "Saved offline.", correctExplanation: "Will sync online.", isOffline: true });
    }
  };

  const handleNextQuestion = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setAnswerResult(null);
      setQuestionStartTime(Date.now());
    } else if (quizMeta) {
      setLoading(true);
      try {
        const res = await fetch("/api/quiz/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId: quizMeta.id }),
        });
        if (res.ok) setFinishResult(await res.json());
      } finally {
        setLoading(false);
        setPhase("finished");
      }
    }
  };

  const handleAddToPlan = async (questionId: string, conceptName: string, reason: string) => {
    setAddingPlanId(questionId);
    try {
      await fetch("/api/plan/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "practice", conceptName, conceptSlug: quizMeta?.topicSlug || "concept-review", estMinutes: 5, reason }),
      });
      setAddedPlanIds((prev) => ({ ...prev, [questionId]: true }));
    } catch {
      setAddedPlanIds((prev) => ({ ...prev, [questionId]: true }));
    } finally {
      setAddingPlanId(null);
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
    setAddedPlanIds({});
  };

  const handleSyncOffline = async () => {
    setSyncing(true);
    try {
      await syncPendingAnswers();
      refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  };

  return {
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
  };
}
