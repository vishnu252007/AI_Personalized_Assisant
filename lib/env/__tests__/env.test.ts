import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getClientEnv,
  _resetClientEnvCache,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_MODEL_IDS,
} from "@/lib/env";
import { getServerEnv, _resetServerEnvCache } from "@/lib/env.server";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Environment & Core Client Harness", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetClientEnvCache();
    _resetServerEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetClientEnvCache();
    _resetServerEnvCache();
  });

  it("verifies test suite is configured and passing", () => {
    expect(true).toBe(true);
  });

  it("defines default model IDs once as constants", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.5-flash");
    expect(DEFAULT_GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    expect(DEFAULT_MODEL_IDS.gemini).toBe("gemini-3.5-flash");
    expect(DEFAULT_MODEL_IDS.groq).toBe("llama-3.3-70b-versatile");
  });

  describe("lib/env.ts: Client Environment Validation", () => {
    it("throws a clear error listing missing variables in development and production (no placeholder fallbacks)", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);

      _resetClientEnvCache();
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    });

    it("throws a clear error for invalid URLs", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";

      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL must be a valid URL/);
    });

    it("parses valid client environment variables successfully", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

      const parsed = getClientEnv();
      expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
      expect(parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
      expect(parsed.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    });

    it("strictly requires NEXT_PUBLIC_SITE_URL in production without default fallback", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      delete process.env.NEXT_PUBLIC_SITE_URL;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      expect(() => getClientEnv()).toThrowError(/NEXT_PUBLIC_SITE_URL/);
    });
  });

  describe("lib/env.server.ts: Server Environment Validation", () => {
    it("throws a clear error listing missing server variables in ALL environments (no placeholder fallbacks)", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(() => getServerEnv()).toThrowError(/GOOGLE_GENERATIVE_AI_API_KEY/);

      _resetServerEnvCache();
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_SITE_URL = "https://learnai.example.com";
      expect(() => getServerEnv()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(() => getServerEnv()).toThrowError(/GOOGLE_GENERATIVE_AI_API_KEY/);
    });

    it("parses valid server environment variables and applies default model IDs", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";

      const parsed = getServerEnv();
      expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
      expect(parsed.SUPABASE_SERVICE_ROLE_KEY).toBe("test-service-key");
      expect(parsed.GOOGLE_GENERATIVE_AI_API_KEY).toBe("test-gemini-key");
      expect(parsed.GEMINI_MODEL).toBe("gemini-3.5-flash");
      expect(parsed.GROQ_MODEL).toBe("llama-3.3-70b-versatile");
    });
  });

  describe("Supabase Client Initialization", () => {
    it("initializes browser client with valid environment variables", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

      const client = createBrowserClient();
      expect(client).toBeDefined();
    });

    it("initializes admin client with service role key", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-gemini-key";

      const admin = createAdminClient();
      expect(admin).toBeDefined();
    });
  });
});
