import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: { toString(): string } | number | string | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  return typeof value === "number" ? value : Number(value.toString());
}

export function dayKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function monthKeyInTimeZone(date: Date, timeZone: string): string {
  return dayKeyInTimeZone(date, timeZone).slice(0, 7);
}
