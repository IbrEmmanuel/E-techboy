# Shared package (logical)

This monorepo currently keeps shared schemas and types inside the Next.js app for simplicity:

- `lib/protocols/` — protocol interfaces and adapters
- `lib/validation/` — Zod schemas
- `types/` — shared TS types

Extract to a published workspace package when a second deployable service needs a hard dependency boundary.
