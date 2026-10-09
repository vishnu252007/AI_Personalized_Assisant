/**
 * LearnAI — Offline Quiz Store & Client Sync Layer (lib/offline/quiz-store.ts)
 * 
 * Supports local offline quiz taking, queueing answers when offline,
 * and background synchronizing when network connectivity is restored.
 */

export interface OfflineQuestion {
  id: string;
  questionText: string;
  options: string[];
  difficulty: number;
  orderIndex: number;
}

export interface OfflineQuiz {
  id: string;
  topicSlug: string;
  topicName: string;
  difficultyLevel: number;
  status: string;
  totalQuestions: number;
  conversationId?: string | null;
  questions: OfflineQuestion[];
  savedAt: number;
}

export interface PendingAnswer {
  id: string;
  quizId: string;
  questionId: string;
  chosenIndex: number;
  timeMs: number;
  queuedAt: number;
}

const STORAGE_KEY_QUIZZES = "learnai:offline_quizzes";
const STORAGE_KEY_PENDING_ANSWERS = "learnai:pending_answers";

// In-memory fallback if localStorage is unavailable (SSR, Node, restricted environments)
const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore localStorage access issues
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memory
  }
  memoryStore.set(key, value);
}

/**
 * Saves a quiz and its questions to local offline storage.
 */
export function saveOfflineQuiz(quiz: OfflineQuiz): void {
  const existing = listOfflineQuizzes();
  const filtered = existing.filter((q) => q.id !== quiz.id);
  filtered.unshift({ ...quiz, savedAt: Date.now() });
  
  // Cap at 20 stored offline quizzes to respect storage limits
  const capped = filtered.slice(0, 20);
  safeSetItem(STORAGE_KEY_QUIZZES, JSON.stringify(capped));
}

/**
 * Retrieves a single stored offline quiz by its ID.
 */
export function getOfflineQuiz(quizId: string): OfflineQuiz | null {
  const list = listOfflineQuizzes();
  return list.find((q) => q.id === quizId) || null;
}

/**
 * Lists all offline-cached quizzes.
 */
export function listOfflineQuizzes(): OfflineQuiz[] {
  const raw = safeGetItem(STORAGE_KEY_QUIZZES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Removes an offline quiz from storage.
 */
export function deleteOfflineQuiz(quizId: string): void {
  const existing = listOfflineQuizzes();
  const remaining = existing.filter((q) => q.id !== quizId);
  safeSetItem(STORAGE_KEY_QUIZZES, JSON.stringify(remaining));
}

/**
 * Queues an answer locally when the client is offline or submission fails.
 */
export function queueOfflineAnswer(answer: Omit<PendingAnswer, "id" | "queuedAt">): PendingAnswer {
  const record: PendingAnswer = {
    ...answer,
    id: `${answer.quizId}-${answer.questionId}-${Date.now()}`,
    queuedAt: Date.now(),
  };

  const existing = getPendingAnswers();
  existing.push(record);
  safeSetItem(STORAGE_KEY_PENDING_ANSWERS, JSON.stringify(existing));
  return record;
}

/**
 * Returns all pending answers queued for synchronization.
 */
export function getPendingAnswers(): PendingAnswer[] {
  const raw = safeGetItem(STORAGE_KEY_PENDING_ANSWERS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clears pending answers from the sync queue, optionally filtered by IDs.
 */
export function clearPendingAnswers(submittedIds?: string[]): void {
  if (!submittedIds || submittedIds.length === 0) {
    safeSetItem(STORAGE_KEY_PENDING_ANSWERS, JSON.stringify([]));
    return;
  }

  const existing = getPendingAnswers();
  const idSet = new Set(submittedIds);
  const remaining = existing.filter((a) => !idSet.has(a.id));
  safeSetItem(STORAGE_KEY_PENDING_ANSWERS, JSON.stringify(remaining));
}

/**
 * Synchronizes pending answers with the server API `/api/quiz/answer`.
 */
export async function syncPendingAnswers(
  customFetch: typeof fetch = fetch
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const pending = getPendingAnswers();
  if (pending.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const syncedIds: string[] = [];
  const errors: string[] = [];

  for (const answer of pending) {
    try {
      const res = await customFetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: answer.quizId,
          questionId: answer.questionId,
          chosenIndex: answer.chosenIndex,
          timeMs: answer.timeMs,
        }),
      });

      if (res.ok) {
        syncedIds.push(answer.id);
      } else {
        const errJson = await res.json().catch(() => ({}));
        errors.push(errJson.error || `HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : "Network error");
    }
  }

  if (syncedIds.length > 0) {
    clearPendingAnswers(syncedIds);
  }

  return {
    synced: syncedIds.length,
    failed: pending.length - syncedIds.length,
    errors,
  };
}
