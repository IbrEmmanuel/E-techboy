import { describe, expect, it } from "vitest";
import { handleRouteError, HttpError } from "@/lib/http";

describe("error handling", () => {
  it("does not leak secrets from environment errors", async () => {
    const response = handleRouteError(new Error("DATABASE_URL postgresql://user:supersecret@host/db"));
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("supersecret");
    expect(body.error.message).toBe("The service is temporarily unavailable");
  });

  it("maps HttpError to consistent API errors", async () => {
    const response = handleRouteError(new HttpError("FORBIDDEN", "You do not have access to this site", 403));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
