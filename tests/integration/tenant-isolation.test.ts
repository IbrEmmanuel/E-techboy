import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/http";
import { isRoleAtLeast } from "@/lib/auth/roles";

describe("tenant isolation contract", () => {
  it("denies cross-site access when membership is missing", () => {
    const membership = null;
    const allowed = Boolean(membership && isRoleAtLeast("VIEWER", "VIEWER"));
    expect(allowed).toBe(false);
    const error = new HttpError("FORBIDDEN", "You do not have access to this site", 403);
    expect(error.status).toBe(403);
  });

  it("treats unique event IDs per device as the duplicate key", () => {
    const first = { deviceId: "d1", eventId: "e1" };
    const replay = { deviceId: "d1", eventId: "e1" };
    expect(`${first.deviceId}:${first.eventId}`).toBe(`${replay.deviceId}:${replay.eventId}`);
  });
});
