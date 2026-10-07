# LearnAI — Master Agent Guidelines & Architecture Rules

## 1. System Overview & Architecture
LearnAI is an adaptive AI-powered learning platform delivering personalized, Socratic tutoring, dynamic quiz generation, Bayesian learning-style adaptation, and spaced repetition tracking.

- **Stack**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode), Tailwind CSS v3, Supabase (PostgreSQL, Auth, RLS, SSR Cookies), Vercel AI SDK (Google Gemini 3.5 Flash primary, Groq LLaMA 3.3 70B fallback).

---

## 2. Core Blueprint Security Rule

> **Derived data (questions, question_keys, attempts, learner_topic_state, quizzes, style_stats) is written only by server routes using the admin client; user-scoped clients are for reads and chat data.**

### Client vs. Server Access Matrix

| Table | Client Capabilities (User-Scoped / Browser Client) | Server Admin Capabilities (`service_role` Admin Client) |
|---|---|---|
| `profiles` | SELECT own, UPDATE own, INSERT own (via auth trigger) | Full administrative access |
| `topics` | SELECT (authenticated users) | Full administrative access |
| `conversations` | SELECT own, INSERT own, UPDATE own, DELETE own | Full administrative access |
| `messages` | SELECT own, INSERT own, DELETE own (updates conversation `updated_at` via trigger) | Full administrative access |
| `quizzes` | **SELECT-only** (Client can read own quizzes) | **Sole write authority** (Create quizzes, update status & scores) |
| `questions` | **SELECT-only** (Client reads questions belonging to own quizzes; options only) | **Sole write authority** (Generate and insert questions) |
| `question_keys` | **Zero client access** (No client RLS policies; answer keys & rationales never exposed) | **Exclusive server access** (Write keys on quiz generation, read during server-side grading) |
| `attempts` | **SELECT-only** (Client reads own graded attempts) | **Sole write authority** (Grade responses, record attempts with latency and correctness) |
| `learner_topic_state` | **SELECT-only** (Client reads mastery score and retention stats) | **Sole write authority** (Update Elo mastery, spaced repetition half-life, and misconceptions) |
| `style_stats` | **SELECT-only** (Client reads learning style distribution) | **Sole write authority** (Update Bayesian alpha/beta parameters based on interaction outcomes) |

---

## 3. Environment & Configuration Rules

1. **Strict Error Handling in All Environments**:
   - Environment variables must be validated through Zod schemas in all environments (development, test, and production).
   - **No placeholder fallbacks** are allowed anywhere.
   - Validation failures must throw a clear, human-readable error detailing every missing or invalid variable.
2. **Centralized Model Identifiers**:
   - Model IDs are defined once centrally in `lib/env.ts` (`DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"` and `DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"`).
3. **Server-Only Boundary Isolation**:
   - Server-only variables (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, etc.) must live in dedicated files starting with `import "server-only";` (e.g., `lib/env.server.ts`).
   - Server-only modules must never be imported into client components or client-facing bundles.

---

## 4. Database Integrity & Constraints

1. **Deterministic Triggers**:
   - Helper trigger functions (such as `set_updated_at()`, `handle_new_user()`, and `touch_conversation_updated_at()`) must explicitly define `SET search_path = ''` for security hardening.
   - Inserting a new message in `public.messages` automatically updates `conversations.updated_at` via the `trigger_messages_touch_conversation` trigger.
2. **Hard Constraints**:
   - `attempts.response_time_ms >= 0` (latency cannot be negative).
   - `learner_topic_state.half_life_days BETWEEN 0.5 AND 365.0` (retention interval bounded to 1 year max).
   - `learner_topic_state.mastery_score BETWEEN 0.0 AND 1.0`.
   - `questions.options` must contain exactly 4 choices (`jsonb_array_length(options) = 4`).
   - `question_keys.rationales` must contain exactly 4 explanations (`jsonb_array_length(rationales) = 4`).

---

## 5. Development Workflow & Quality Gates

Before completing any task, verify the build and test health with the following commands:
1. `npx tsc --noEmit` — Static type checking across the entire repository.
2. `npm run lint` — ESLint validation for Next.js App Router and React rules.
3. `npm run build` — Optimized production bundle build.
4. `npm test` — Unit and integration tests via Vitest.

**Phase Discipline**: Strictly honor phase boundaries. Never begin tasks or code generation for future phases until explicitly instructed.
