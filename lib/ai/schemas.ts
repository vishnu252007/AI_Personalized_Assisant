import { z } from "zod";

/**
 * Analyzer LLM Structured Output Schema.
 * Evaluates conversational turns to extract topic, estimated difficulty (1-5),
 * understanding probability (0.0 to 1.0), and specific confusion signals.
 */
export const analyzerOutputSchema = z.object({
  topicSlug: z.string().min(1, "Topic slug is required"),
  difficulty: z.number().int().min(1).max(5),
  understood: z.number().min(0.0).max(1.0),
  confusionSignals: z.array(z.string()).default([]),
});

export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>;

/**
 * Single Quiz Question Schema for LLM generation.
 * Enforces exactly 4 options, 4 rationales, and 4 misconception tags (null for the correct option).
 */
export const quizQuestionSchema = z.object({
  questionText: z.string().min(5, "Question text must be at least 5 characters"),
  difficulty: z.number().int().min(1).max(5),
  options: z.array(z.string().min(1)).length(4, "Must provide exactly 4 options"),
  correctIndex: z.number().int().min(0).max(3),
  rationales: z.array(z.string().min(1)).length(4, "Must provide exactly 4 rationales"),
  misconceptionTags: z.array(z.string().nullable()).length(4, "Must provide 4 misconception tags"),
}).refine((data) => data.misconceptionTags[data.correctIndex] === null, {
  message: "Correct option must have null misconception tag",
  path: ["misconceptionTags"],
});

export type QuizQuestionGenerated = z.infer<typeof quizQuestionSchema>;

/**
 * Batch Quiz Generation Schema.
 */
export const quizBatchGenerationSchema = z.object({
  topicSlug: z.string(),
  subject: z.string().default("Computer Science"),
  questions: z.array(quizQuestionSchema).min(1).max(10),
});

export type QuizBatchGenerated = z.infer<typeof quizBatchGenerationSchema>;

/**
 * Client Quiz Answer Submission Payload Schema.
 */
export const submitAnswerSchema = z.object({
  quizId: z.string().uuid("Invalid quiz ID"),
  questionId: z.string().uuid("Invalid question ID"),
  chosenIndex: z.number().int().min(0).max(3),
  timeMs: z.number().int().min(0, "Latency cannot be negative"),
});

export type SubmitAnswerPayload = z.infer<typeof submitAnswerSchema>;

/**
 * Quiz Generation Request Payload Schema.
 * Supports open topics, chat conversations, and recommended/diagnostic modes.
 */
export const generateQuizRequestSchema = z.object({
  topicSlug: z.string().optional(),
  conversationId: z.string().uuid("Invalid conversation UUID").optional(),
  conceptName: z.string().min(1).max(100).optional(),
  mode: z.enum(["recommended", "topic", "diagnostic", "chat"]).default("recommended"),
  count: z.number().int().min(1).max(10).optional(),
});

export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;
