# LearnAI — Requirements Specification

## 1. Runtime Environment
- **Node.js**: `>= 18.18.0` (LTS recommended, tested on Node v22.18.0)
- **Package Manager**: `npm` (tested on npm 10.9.3), `pnpm`, or `yarn`
- **Operating System**: Cross-platform (Windows, macOS, Linux)

---

## 2. Production Dependencies

| Package Name | Target Version | Functional Purpose |
|---|---|---|
| `next` | `^15.1.7` | Next.js App Router full-stack web framework |
| `react` / `react-dom` | `^19.0.0` | React core library and DOM renderer |
| `@supabase/ssr` | `^0.5.2` | Server-side cookie client for Supabase auth across SSR, Actions, and Route Handlers |
| `@supabase/supabase-js` | `^2.49.1` | Supabase JavaScript client, PostgreSQL queries, and type definitions |
| `ai` | `^4.1.41` | Vercel AI SDK core and `useChat` streaming hooks |
| `@ai-sdk/google` | `^1.1.13` | Google Gemini provider adapter for Vercel AI SDK |
| `zod` | `^3.23.8` | Schema validation for API payloads, cognitive models, and structured LLM JSON outputs |
| `recharts` | `^2.15.1` | Responsive data visualization charts for analytics and retention tracking |
| `lucide-react` | `^0.475.0` | Modern SVG icon set for navigation, status indicators, and actions |
| `clsx` / `tailwind-merge` | `^2.1.1` / `^2.6.0` | Conditional CSS class composition and conflict resolution |
| `@upstash/redis` | `^1.34.4` | Redis REST client for distributed rate limiting (optional, with in-memory fallback) |
| `@upstash/ratelimit` | `^2.0.5` | Sliding window rate limit algorithms |
| `next-themes` | `^0.4.4` | Theme management for dark/light mode toggling |

---

## 3. Development Dependencies

| Package Name | Target Version | Functional Purpose |
|---|---|---|
| `typescript` | `^5.7.3` | Static type checking and compiler |
| `@types/node` | `^20.17.19` | Node.js type definitions |
| `@types/react` / `@types/react-dom` | `^19.0.8` / `^19.0.3` | React 19 type definitions |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework |
| `postcss` / `autoprefixer` | `^8.5.1` / `^10.4.20` | CSS processing and vendor prefixing |
| `eslint` / `eslint-config-next` | `^9.19.0` / `^15.1.7` | Code quality, linting, and Next.js best practices |
| `vitest` | `^3.0.5` | Fast unit testing framework for cognitive math and algorithms |

---

## 4. External Services & Cloud Accounts

1. **Supabase**: PostgreSQL database with Row Level Security, User Authentication, and SSR cookies.
2. **Google AI Studio**: Gemini API key (`gemini-2.0-flash` / `gemini-1.5-flash`) for Socratic tutoring and quiz generation.
3. **Upstash Redis (Optional)**: Distributed sliding-window rate limiting; in-memory fallback enabled when omitted.
4. **Groq Console (Optional)**: Fallback model inference if configured.
