export interface QuestionItem {
  id: string;
  questionText: string;
  options: string[];
  difficulty: number;
  orderIndex: number;
}

export interface QuizMeta {
  id: string;
  topicSlug: string;
  topicName: string;
  difficultyLevel: number;
  totalQuestions: number;
  conversationId?: string | null;
}

export interface AnswerResult {
  correct: boolean;
  correctIndex: number;
  chosenExplanation: string;
  correctExplanation: string;
  isOffline?: boolean;
}

export interface FinishResult {
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

export type QuizMode = "diagnostic" | "topic" | "recommended" | "chat";
