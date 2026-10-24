import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CRON_SECRET: z.string().min(16).optional(),
  ALLOW_SIMULATED_TELEMETRY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  STALE_AFTER_SECONDS: z.coerce.number().int().positive().default(120),
  LIVE_POLL_INTERVAL_MS: z.coerce.number().int().min(2000).max(60000).default(8000),
  RESEND_API_KEY: z.string().optional(),
  ALERT_FROM_EMAIL: z.string().email().optional(),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  MQTT_BRIDGE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  REALTIME_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  REALTIME_INTERNAL_URL: z.string().url().optional(),
  REALTIME_INTERNAL_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_REALTIME_WS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.ALLOW_SIMULATED_TELEMETRY) {
    throw new Error("ALLOW_SIMULATED_TELEMETRY cannot be true in production");
  }
  cached = parsed.data;
  return cached;
}

export function allowSimulatedTelemetry(): boolean {
  return getEnv().ALLOW_SIMULATED_TELEMETRY && getEnv().NODE_ENV !== "production";
}
