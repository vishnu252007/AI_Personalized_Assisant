# LearnAI — Requirements Specification

## 1. Runtime Environment
- **Node.js**: `>= 20.9.0` (LTS recommended, tested on Node v22.18.0)
- **Package Manager**: `npm` (tested on npm 10.9.3), `pnpm`, or `yarn`
- **Operating System**: Cross-platform (Windows, macOS, Linux)

---

## 2. Production Dependencies

| Package Name | Installed Version (Lockfile) | Functional Purpose |
|---|---|---|
| `next` | `15.5.27` | Next.js App Router full-stack web framework |
| `react` / `react-dom` | `19.3.0` | React core library and DOM renderer |
| `@supabase/ssr` | `0.12.7` | Server-side cookie client for Supabase auth across SSR, Actions, and Route Handlers |
| `@supabase/supabase-js` | `2.117.2` | Supabase JavaScript client, PostgreSQL queries, and type definitions |
| `ai` | `7.0.128` | Vercel AI SDK core and AI streaming abstractions |
| `@ai-sdk/react` | `4.0.131` | React hooks for Vercel AI SDK (`useChat`, `useCompletion`) |
| `@ai-sdk/google` | `4.0.88` | Google Gemini provider adapter for Vercel AI SDK |
| `@ai-sdk/groq` | `4.0.55` | Groq provider adapter for Vercel AI SDK |
| `zod` | `3.25.76` | Schema validation for API payloads, environment variables, cognitive models, and structured LLM outputs |
| `recharts` | `3.10.1` | Responsive data visualization charts for analytics and retention tracking |
| `lucide-react` | `0.475.0` | Modern SVG icon set for navigation, status indicators, and actions |
| `clsx` / `tailwind-merge` | `2.1.1` / `2.6.1` | Conditional CSS class composition and conflict resolution |
| `@upstash/redis` | `1.39.0` | Redis REST client for distributed rate limiting (optional, with in-memory fallback) |
| `@upstash/ratelimit` | `2.2.0` | Sliding window rate limit algorithms |
| `next-themes` | `0.4.6` | Theme management for dark/light mode toggling |
| `server-only` | `0.0.1` | Boundary isolation ensuring server environment and secrets are never leaked to client bundles |

---

## 3. Development Dependencies

| Package Name | Installed Version (Lockfile) | Functional Purpose |
|---|---|---|
| `typescript` | `5.9.3` | Static type checking and compiler |
| `@types/node` | `20.19.43` | Node.js type definitions |
| `@types/react` / `@types/react-dom` | `19.3.0` / `19.3.0` | React 19 type definitions |
| `tailwindcss` | `3.4.19` | Utility-first CSS framework (v3 LTS kept as configured) |
| `postcss` / `autoprefixer` | `8.5.29` / `10.6.1` | CSS processing and vendor prefixing |
| `eslint` / `eslint-config-next` | `9.39.5` / `15.5.27` | Code quality, linting, and Next.js best practices |
| `@eslint/eslintrc` | `3.3.7` | Flat compat for Next.js ESLint configuration |
| `vitest` | `3.2.7` | Fast unit testing framework for cognitive math and algorithms |

---

## 4. External Services & Cloud Accounts

1. **Supabase**: PostgreSQL database with Row Level Security, User Authentication, and SSR cookies.
2. **Google AI Studio**: Gemini API key (`gemini-3.5-flash`) for Socratic tutoring and quiz generation.
3. **Groq Console**: Groq API key (`llama-3.3-70b-versatile`) for fast fallback inference.
4. **Upstash Redis (Optional)**: Distributed sliding-window rate limiting; in-memory fallback enabled when omitted.
