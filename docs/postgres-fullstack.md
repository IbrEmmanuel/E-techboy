# Full-stack Postgres (Neon + Vercel)

This project is built for **managed Postgres + Vercel serverless**.

Recommended combo: **Neon Postgres** + **Vercel** (ESP devices use HTTPS ingest).

---

## Quick path (Neon)

### A. Create the database (2 minutes)

1. Open [https://console.neon.tech](https://console.neon.tech) and sign in (GitHub is fine).
2. **New Project**
   - Name: `energy-monitor`
   - Region: closest to you / your Vercel region
   - Postgres version: default
3. Open **Dashboard → Connection details**
4. Copy the connection string (URI), e.g.

```text
postgresql://neondb_owner:xxxx@ep-cool-name-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Neon also shows a **pooled** connection — use that for `DATABASE_URL` when available.

### B. Provision this app against Neon

From the project folder:

```bash
npm run db:provision -- --from-neon-connection-string "PASTE_NEON_URI_HERE" --push --seed
```

This will:

- Write `.env.production.local` + `.env.remote` (gitignored)
- Write `.vercel-env-production.txt` for Vercel
- Generate `AUTH_SECRET`, `CRON_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`
- `prisma db push` schema
- Seed demo owner user + device

### C. Deploy to Vercel

```bash
npx vercel login
npx vercel
```

In Vercel → **Settings → Environment Variables**, add every line from `.vercel-env-production.txt`, then set:

```text
APP_URL=https://YOUR-PROJECT.vercel.app
ALLOW_SIMULATED_TELEMETRY=false
NODE_ENV=production
```

Redeploy:

```bash
npx vercel --prod
```

Smoke test:

```bash
curl https://YOUR-PROJECT.vercel.app/api/v1/health
```

---

## Alternatives

### Supabase

1. [supabase.com](https://supabase.com) → New project  
2. **Project Settings → Database** → connection strings  
   - **Transaction / pooler** → `DATABASE_URL`  
   - **Direct** → `DIRECT_URL`  
3. Same provision command with both URLs:

```bash
npm run db:provision -- --database-url "postgresql://...pooler..." --direct-url "postgresql://...direct..." --push --seed
```

### Vercel Postgres

1. Vercel dashboard → your project → **Storage** → Create **Postgres**  
2. Click **Connect** to inject `POSTGRES_URL` / Prisma vars  
3. Map to this app:
   - `DATABASE_URL` = pooled Prisma URL from Vercel  
   - `DIRECT_URL` = non-pooled URL  
4. Run `npm run db:provision -- ... --push --seed` (or set env then `npx prisma db push && npm run db:seed`)

---

## What “full stack” means here

| Layer | Host |
|-------|------|
| UI + REST APIs | Vercel |
| Postgres | Neon / Supabase / Vercel Postgres |
| ESP devices | HTTPS → `/api/v1/telemetry` on your Vercel URL |
| Optional WebSocket | Separate host (not Vercel serverless) |

Local embedded Postgres (`.pgdata`) remains for offline demos only.
