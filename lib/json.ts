import type { Prisma } from "@prisma/client";

/** Narrow unknown JSON-ish values for Prisma InputJsonValue assignments. */
export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function asJsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return asJson(value);
}
