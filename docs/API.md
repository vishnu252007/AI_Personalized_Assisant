# LearnAI — API Specifications (v2)

This document formalizes the runtime HTTP contracts, data schemas, authentication invariants, and rate limits for LearnAI.

---

## 1. Authentication & Security Invariants

1. **Session & Auth Cookies**: Client requests authenticate using Supabase SSR cookies (`@supabase/ssr`). Middleware automatically refreshes sessions and rejects unauthenticated API traffic with `401 Unauthorized` (`code: UNAUTHORIZED`).
2. **Derived Data Security Matrix**:
   - Client-scoped authenticated connections have write access *only* to `conversations`, `messages`, and their own `profiles`.
   - Derived cognitive data (`quizzes`, `questions`, `question_keys`, `attempts`, `learner_topic_state`, `style_stats`, `concepts`, `learning_events`) can **only** be written by server routes using the `service_role` admin client.
3. **Data Sanitization**:
   - Any LLM-derived tags must match `/^[a-z0-9-]{1,40}$/`.
   - Profile context injected into prompts is capped at 600 characters and isolated within `<student_data>` tags to prevent prompt injection.
4. **Rate Limits**:
   - `chat`: 20 requests / minute per user (sliding window).
   - `quizGenerate`: 5 requests / minute per user (sliding window).

---

## 2. API Endpoints

### 2.1 Chat API

#### `POST /api/chat`
Streams personalized AI tutor guidance for the student.

- **Rate Limit**: 20 requests / min (`chat` bucket).
- **Headers**:
  - `Content-Type: application/json`
  - Response includes `Server-Timing: auth;dur=..., db;dur=..., ai;dur=...`
- **Request Body Contract**:
```json
{
  "id": "e2a05cf6-397a-4ecb-99f8-d421a9cbfda0",
  "message": {
    "id": "msg-1234",
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "How does binary search work on a sorted array?"
      }
    ]
  }
}
```

- **Validation Rules**:
  - `id`: Valid UUID string (client-generated conversation ID).
  - `message.role`: Must be `"user"`.
  - `message.parts`: Array containing at least one `{ type: "text", text: string }`.
  - `message.parts[0].text`: Length between 1 and 4000 characters.
- **Server Execution Semantics**:
  1. Verifies the authenticated user via `requireUser()`.
  2. Resolves conversation with `id`:
     - If non-existent in database, automatically creates it for the authenticated user.
     - If existing, verifies ownership (`user_id === user.id`); returns `404 Not Found` if owned by someone else.
  3. Authoritatively loads conversation history from PostgreSQL `messages` table (never trusts client history).
  4. Saves the incoming user message to `messages` and asserts no insert errors.
  5. Evaluates pedagogical style using Bayesian Thompson Sampling (`style_stats`).
  6. Streams response via `createUIMessageStreamResponse` using `toUIMessageStream`.
  7. Attaches `{ style: string, conceptIds?: string[] }` as UI message metadata at stream start.
  8. Saves assistant message to PostgreSQL in the stream `onEnd` callback.
  9. Handles stream interruptions and timeouts gracefully via composite `AbortSignal`.

---

### 2.2 Conversations API

#### `GET /api/conversations/[id]`
Retrieves full history for a conversation shaped for the UI message stream client.

- **Response Shape**:
```json
{
  "conversationId": "e2a05cf6-397a-4ecb-99f8-d421a9cbfda0",
  "title": "Binary search fundamentals",
  "messages": [
    {
      "id": "9d41938b-d7d8-4f81-9b16-5dcae613fbd1",
      "role": "user",
      "parts": [{ "type": "text", "text": "What is binary search?" }],
      "createdAt": 1718000000000
    },
    {
      "id": "b3e32e8d-8cfa-42f0-93bc-3023e164219a",
      "role": "assistant",
      "parts": [{ "type": "text", "text": "Binary search is an efficient algorithm..." }],
      "createdAt": 1718000005000,
      "metadata": {
        "style": "analogy"
      }
    }
  ]
}
```
- **Status Codes**:
  - `200 OK`: Successful fetch.
  - `401 Unauthorized`: Not logged in.
  - `404 Not Found`: Conversation does not exist or belongs to another user.

#### `GET /api/conversations`
Lists the user's conversations ordered by `updated_at DESC`.

#### `DELETE /api/conversations`
Deletes a conversation by ID (`?id=<uuid>`).

---

### 2.3 Quiz Assessment API

#### `POST /api/quiz/generate`
Generates an adaptive multiple-choice quiz targeting the student's mastery gaps or requested topic.

- **Rate Limit**: 5 requests / min (`quizGenerate` bucket).
- **Request Body**:
```json
{
  "mode": "weak_areas" | "topic" | "review",
  "topicSlug": "binary-search"
}
```
- **Behavior**: Generates 3 questions with 4 options each. Correct answers and rationales are written strictly to `question_keys` on the server.

#### `POST /api/quiz/answer`
Evaluates a single question answer atomically with row-level locks.

- **Request Body**:
```json
{
  "quizId": "48bb8f0f-6fb6-4556-9a28-66248d28c89c",
  "questionId": "1a007f35-430c-4fa6-848e-73cb6d860e67",
  "chosenIndex": 2,
  "timeMs": 4200
}
```
- **Response**:
```json
{
  "correct": true,
  "correctIndex": 2,
  "chosenExplanation": "Correct! Binary search operates in logarithmic O(log n) time.",
  "correctExplanation": "Correct! Binary search operates in logarithmic O(log n) time."
}
```
- **Error Codes**:
  - `400 Bad Request`: Inactive quiz or missing fields.
  - `404 Not Found`: Question does not belong to quiz or quiz not found.
  - `409 Conflict` (`DUPLICATE_SUBMISSION`): Question has already been answered.

---

### 2.4 User Management & Privacy API

#### `DELETE /api/me`
Permanently deletes the authenticated user's account and all associated learner data.

- **Request Body**:
```json
{
  "confirm": "DELETE"
}
```
- **Status Codes**:
  - `200 OK`: Account and all cascaded data permanently purged.
  - `400 Bad Request`: Missing or incorrect `{ confirm: "DELETE" }`.
  - `401 Unauthorized`: Unauthenticated.
