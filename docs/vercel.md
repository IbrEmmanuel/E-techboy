# Deploy EnergyMonitor on Vercel

## What works on Vercel

| Feature | On Vercel? |
|---------|------------|
| Next.js UI + REST APIs | Yes |
| Device **HTTP** ingest `POST /api/v1/telemetry` | Yes (ESP recommended path) |
| Device **HTTP** universal ingest | Yes |
| Dashboard polling (live metrics every few seconds) | Yes |
| Postgres (Neon / Supabase / Vercel Postgres) | Yes |
| Vercel Cron (stale devices) | Yes (Pro for custom crons; Hobby has limits) |
| Persistent **WebSocket** server (`npm run realtime`) | **No** — not supported in serverless |
| Always-on MQTT / Modbus sockets | **No** — use gateway / separate host |

**For ESP hardware on Vercel: use HTTPS HTTP ingest.** WebSocket is optional and must run elsewhere (Railway, Fly.io, Render, VPS).

---

## 1. Database (full stack)

Use managed Postgres — **Neon is the recommended path**.

Step-by-step: **[postgres-fullstack.md](./postgres-fullstack.md)**

```bash
# After you copy the Neon connection URI from console.neon.tech:
npm run db:provision -- --from-neon-connection-string "postgresql://...?sslmode=require" --push --seed
```

That writes production secrets + `.vercel-env-production.txt`, pushes schema, and seeds the owner account.

Alternatives: Supabase or Vercel Postgres (same provision script with `--database-url` + `--direct-url`).

---

## 2. Vercel project

```bash
npm i -g vercel
vercel login
vercel
```

Or: GitHub → Vercel → Import this repo → Framework **Next.js**.

Build settings (defaults are fine):

- Build command: `prisma generate && next build` (already in `package.json` `build`)
- Install: `npm install` (runs `postinstall` → `prisma generate`)

---

## 3. Environment variables (Vercel → Settings → Environment Variables)

Set for **Production** (and Preview if you want):

| Variable | Example / notes |
|----------|------------------|
| `DATABASE_URL` | Pooled Postgres URL |
| `DIRECT_URL` | Direct Postgres URL |
| `AUTH_SECRET` | ≥32 random chars (`openssl rand -base64 32`) |
| `APP_URL` | `https://your-app.vercel.app` |
| `NODE_ENV` | `production` |
| `ALLOW_SIMULATED_TELEMETRY` | **`false`** (required in production) |
| `CRON_SECRET` | ≥16 random chars (for `/api/v1/jobs/stale-check`) |
| `CREDENTIALS_ENCRYPTION_KEY` | ≥32 chars |
| `LIVE_POLL_INTERVAL_MS` | `8000` |
| `STALE_AFTER_SECONDS` | `120` |

Optional:

- `RESEND_API_KEY` / `ALERT_FROM_EMAIL` — email alerts  
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_WEBHOOK_SECRET` — billing  
- `NEXT_PUBLIC_REALTIME_WS_URL` — only if you host realtime elsewhere, e.g. `wss://realtime.yourdomain.com`  
- `REALTIME_INTERNAL_URL` / `REALTIME_INTERNAL_SECRET` — so Vercel can fan-out to that host after HTTP ingest  

Redeploy after saving env vars.

---

## 4. Cron (stale devices)

`vercel.json` already schedules:

```json
{ "path": "/api/v1/jobs/stale-check", "schedule": "*/5 * * * *" }
```

The route expects:

```http
Authorization: Bearer <CRON_SECRET>
```

On Vercel, set `CRON_SECRET` in project env; Vercel Cron sends it as Bearer automatically when configured.

---

## 5. Point ESP firmware at Vercel

In `firmware/esp32/src/secrets.h`:

```cpp
#define WIFI_SSID "YourWiFi"
#define WIFI_PASSWORD "YourPassword"
#define APP_BASE_URL "https://your-app.vercel.app"
#define DEVICE_PUBLIC_ID "esp32_xxxxx"
#define DEVICE_TOKEN "esp32_xxxxx.secret-from-devices-page"
#define FIRMWARE_VERSION "0.2.0"
```

ESP posts to:

```text
https://your-app.vercel.app/api/v1/telemetry
Authorization: Bearer <DEVICE_TOKEN>
```

Use **real** (`simulated: false`) readings in production — simulated payloads are rejected.

Create the device in the deployed app (**Devices** / **Connect**), copy the token once, flash the board.

---

## 6. Optional: WebSocket on another host

If you still want live WebSockets:

1. Deploy `realtime/server.ts` to Railway / Fly / a VPS  
2. Set the same `AUTH_SECRET` + `APP_URL=https://your-app.vercel.app`  
3. On Vercel set:
   - `NEXT_PUBLIC_REALTIME_WS_URL=wss://your-realtime-host`
   - `REALTIME_INTERNAL_URL=https://your-realtime-host`
   - `REALTIME_INTERNAL_SECRET=<same secret>`

Without that, the dashboard keeps working via **HTTP polling** every 8s.

---

## 7. Smoke test after deploy

```bash
curl https://your-app.vercel.app/api/v1/health
```

Expect `"database":"up"`. WebSocket may show `"down"` — that is normal on Vercel-only.

Login in the browser, create a device, flash ESP, confirm dashboard updates.
