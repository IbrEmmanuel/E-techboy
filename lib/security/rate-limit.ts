import "server-only";

import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

export async function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  try {
    const row = await prisma.rateLimitCounter.upsert({
      where: { key_windowStart: { key, windowStart } },
      update: { count: { increment: 1 } },
      create: { key, windowStart, count: 1 },
    });
    if (row.count > limit) {
      throw new HttpError("RATE_LIMITED", "Too many requests", 429);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/Can't reach database server|P1001|ECONNREFUSED/i.test(message)) {
      throw new HttpError(
        "SERVICE_UNAVAILABLE",
        "Database is unreachable. Start PostgreSQL and run: npx prisma db push && npm run db:seed",
        503,
      );
    }
    throw error;
  }
}

export function clientKey(request: Request, suffix: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${suffix}`;
}
