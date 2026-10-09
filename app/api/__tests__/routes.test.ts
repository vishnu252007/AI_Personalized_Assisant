import { describe, it, expect, beforeEach } from "vitest";
import { POST as chatPost } from "@/app/api/chat/route";
import { POST as quizGeneratePost } from "@/app/api/quiz/generate/route";
import { POST as quizAnswerPost } from "@/app/api/quiz/answer/route";
import { POST as quizFinishPost } from "@/app/api/quiz/finish/route";
import { GET as dashboardGet } from "@/app/api/dashboard/route";
import { DELETE as meDelete } from "@/app/api/me/route";
import { GET as conversationByIdGet } from "@/app/api/conversations/[id]/route";

describe("Route Handlers Security & Validation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";
  });

  describe("POST /api/chat", () => {
    it("returns 401 Unauthorized when request lacks authenticated session", async () => {
      const req = new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "123e4567-e89b-12d3-a456-426614174000",
          message: {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text", text: "Hello Socratic tutor" }],
          },
        }),
      });

      const res = await chatPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/conversations/[id]", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/conversations/123e4567-e89b-12d3-a456-426614174000");
      const res = await conversationByIdGet(req, {
        params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/quiz/generate", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "recommended" }),
      });

      const res = await quizGeneratePost(req);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/quiz/answer", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: "123e4567-e89b-12d3-a456-426614174000",
          questionId: "123e4567-e89b-12d3-a456-426614174001",
          chosenIndex: 0,
          timeMs: 2500,
        }),
      });

      const res = await quizAnswerPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/quiz/finish", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/quiz/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: "123e4567-e89b-12d3-a456-426614174000",
        }),
      });

      const res = await quizFinishPost(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/dashboard", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await dashboardGet();
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/me", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const res = await meDelete(req);
      expect(res.status).toBe(401);
    });
  });
});
