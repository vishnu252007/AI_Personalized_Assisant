import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveOfflineQuiz,
  getOfflineQuiz,
  listOfflineQuizzes,
  deleteOfflineQuiz,
  queueOfflineAnswer,
  getPendingAnswers,
  clearPendingAnswers,
  syncPendingAnswers,
  type OfflineQuiz,
} from "../quiz-store";

describe("lib/offline/quiz-store", () => {
  beforeEach(() => {
    // Clear state before each test
    clearPendingAnswers();
    const all = listOfflineQuizzes();
    all.forEach((q) => deleteOfflineQuiz(q.id));
  });

  const sampleQuiz: OfflineQuiz = {
    id: "test-quiz-123",
    topicSlug: "binary-search",
    topicName: "Binary Search",
    difficultyLevel: 2,
    status: "in_progress",
    totalQuestions: 1,
    savedAt: Date.now(),
    questions: [
      {
        id: "q-1",
        questionText: "What is the runtime of binary search?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
        difficulty: 2,
        orderIndex: 0,
      },
    ],
  };

  it("saves and retrieves offline quiz", () => {
    saveOfflineQuiz(sampleQuiz);
    const retrieved = getOfflineQuiz("test-quiz-123");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.topicSlug).toBe("binary-search");
    expect(retrieved?.questions.length).toBe(1);

    const all = listOfflineQuizzes();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe("test-quiz-123");
  });

  it("deletes offline quiz", () => {
    saveOfflineQuiz(sampleQuiz);
    deleteOfflineQuiz("test-quiz-123");
    expect(getOfflineQuiz("test-quiz-123")).toBeNull();
  });

  it("queues pending offline answers", () => {
    const answer = queueOfflineAnswer({
      quizId: "test-quiz-123",
      questionId: "q-1",
      chosenIndex: 1,
      timeMs: 2500,
    });

    expect(answer.id).toBeDefined();
    expect(answer.queuedAt).toBeGreaterThan(0);

    const pending = getPendingAnswers();
    expect(pending.length).toBe(1);
    expect(pending[0].chosenIndex).toBe(1);
  });

  it("syncs pending answers successfully", async () => {
    queueOfflineAnswer({
      quizId: "test-quiz-123",
      questionId: "q-1",
      chosenIndex: 1,
      timeMs: 2500,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ correct: true }),
    } as unknown as Response);

    const result = await syncPendingAnswers(mockFetch as unknown as typeof fetch);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(getPendingAnswers().length).toBe(0);
  });

  it("handles failed sync gracefully", async () => {
    queueOfflineAnswer({
      quizId: "test-quiz-123",
      questionId: "q-1",
      chosenIndex: 1,
      timeMs: 2500,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    } as unknown as Response);

    const result = await syncPendingAnswers(mockFetch as unknown as typeof fetch);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(getPendingAnswers().length).toBe(1);
  });
});
