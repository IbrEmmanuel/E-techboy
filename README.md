# E-techboy

EnergyMonitor — Universal IoT, Smart Grid & Industrial Automation

Production-oriented energy monitoring platform upgraded with a modular protocol adapter framework, device connection center, gateway agent, automation workspace, and smart-grid views — while preserving the existing ESP32 energy dashboard.

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn-style UI
- PostgreSQL via Prisma (Supabase-compatible; RLS notes in `supabase/migrations`)
- Zod validation, Vitest + Playwright
- Persistent industrial/MQTT connections: `gateway/` agent (not Vercel serverless)

## Quick start (Windows / no system Postgres)

Terminal 1 — embedded PostgreSQL:

```bash
npm install
npm run db:local
```

Terminal 2 — schema + app:

```bash
npx prisma db push
npm run db:seed
npm run dev
```

Or one command: `npm run dev:all`

Open http://localhost:3000 — login: `owner@example.com` / `ChangeMeNow1!`

## Key routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Existing energy desk |
| `/integrations` | Universal device connection wizard |
| `/devices` | Device registry + detail dashboards |
| `/gateways` | Edge gateway credentials |
| `/smart-grid` | Microgrid / energy balance workspace |
| `/automation` | Rules with dry-run + safety notes |
| `/billing` | Subscription entitlements |

## Documentation

- [Deploy on Vercel](docs/vercel.md) — ESP uses HTTPS; WebSocket is optional elsewhere
- [Full-stack Postgres (Neon)](docs/postgres-fullstack.md) — create DB + provision + seed
- [API](docs/api.md)
- [Protocols](docs/protocols.md)
- [MQTT](docs/mqtt.md)
- [Modbus maps](docs/modbus-register-maps.md)
- [Raspberry Pi gateway](docs/gateway-raspberry-pi.md)
- [Security & safety](docs/security-and-safety.md)
- [Deployment](docs/deployment.md)
- [Hardware compatibility](docs/hardware-compatibility.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run simulate        # one-shot HTTP device ingest
npm run simulate:loop   # continuous HTTP telemetry (+ solar/battery)
npm run simulate:ws     # continuous **live WebSocket** hardware path
npm run realtime        # WebSocket server (devices + dashboard) on :3001
npm run gateway:dev     # edge agent (set ENERGYMONITOR_URL + GATEWAY_TOKEN)
```

### Live hardware / API / WebSocket

1. Seed token: `esp32_demo000001.demo-device-secret-do-not-use-in-prod`
2. `ALLOW_SIMULATED_TELEMETRY=true` in local `.env`
3. Terminals:
   - `npm run db:local`
   - `npm run realtime`  → `ws://127.0.0.1:3001`
   - `npm run dev`       → `http://localhost:3000`
4. Hardware options:
   - **HTTP API:** `POST /api/v1/telemetry` with `Authorization: Bearer <token>`
   - **WebSocket:** `ws://host:3001/device?token=<token>` send `{ type:"telemetry", ... }`
5. Dashboard auto-subscribes via `/api/v1/realtime/ticket` → `/live` (HTTP polling remains fallback)

```bash
npm run simulate:ws
```

Gateway agent (optional Modbus-style poll):

```bash
set ENERGYMONITOR_URL=http://localhost:3000
set GATEWAY_TOKEN=gw_lab_pi_0001.demo-gateway-secret-do-not-use-in-prod
set LOCAL_DEVICE_TOKEN=esp32_demo000001.demo-device-secret-do-not-use-in-prod
npm run gateway:dev
```

## Honest capability status

- **Implemented full-stack:** HTTP + **WebSocket** device ingest, dashboard live WS fan-out, dual-write telemetry, automation on ingest, smart-grid snapshots, gateways, billing activate, device commands
- **Gateway required for live industrial I/O:** MQTT broker sessions, Modbus TCP/RTU to real PLCs
- **Stub / planned:** OPC UA, BACnet, LoRaWAN, Zigbee/Thread/BLE, CAN, most vendor APIs
- **Note:** Persistent WebSockets run via `npm run realtime` (not inside Vercel serverless functions)

Do not treat a successful **config test** as a live hardware connection unless the realtime server health check is up.
