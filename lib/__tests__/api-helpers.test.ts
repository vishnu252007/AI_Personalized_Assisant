import { describe, it, expect } from "vitest";
import { apiError, handleRouteError } from "@/lib/api-helpers";

describe("Shared API Helpers (lib/api-helpers.ts)", () => {
  it("never returns internal error messages to client callers when status >= 500", async () => {
    const res = apiError(
      "database connection password=secret timeout at 10.0.0.1",
      "DB_FAILURE",
      500,
      { stack: "Sensitive stack trace" }
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.code).toBe("DB_FAILURE");
    expect(body.details).toBeUndefined();
  });

  it("passes safe message through for client 4xx errors", async () => {
    const res = apiError("Invalid email format", "VALIDATION_ERROR", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid email format");
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("handleRouteError catches unknown errors and yields safe 500 response", async () => {
    const error = new Error("Database query crashed unexpectedly");
    const res = handleRouteError(error, "Failed to complete operation");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
