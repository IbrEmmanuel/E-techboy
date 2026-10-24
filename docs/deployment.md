# Deployment architecture

| Component | Recommended host | Notes |
|-----------|------------------|-------|
| Web + short-lived APIs | **Vercel** (or compatible) | ESP uses HTTPS ingest here |
| Database + optional Auth | Neon / Supabase / Vercel Postgres | Prisma + app sessions |
| Live WebSocket fan-out | Railway / Fly / VPS (`npm run realtime`) | **Not** on Vercel serverless |
| Persistent MQTT broker | Managed MQTT or self-hosted | TLS required |
| Gateway agent | Raspberry Pi / industrial PC | Outbound HTTPS |
| Protocol workers | Long-running Node/systemd service | Same as gateway or separate worker |
| Secrets | Env vars / secret manager | Never ship service-role keys to the browser |
| Billing | Paystack (NG) | Server-side + webhook signature verification |

**Vercel step-by-step:** see [vercel.md](./vercel.md).

## Free-tier / cost expectations

- Demo mode can run cheaply with simulated devices
- Unlimited industrial telemetry, always-on Modbus polling, and multi-site gateways are **not** zero-cost
- Expect database storage, egress, broker, and edge hardware costs as you scale

## Environment

See `.env.example`. Minimum for local demo:

- `DATABASE_URL` / `DIRECT_URL`
- `AUTH_SECRET`
- `ALLOW_SIMULATED_TELEMETRY=true` (development only)
- `CREDENTIALS_ENCRYPTION_KEY` (recommended)
