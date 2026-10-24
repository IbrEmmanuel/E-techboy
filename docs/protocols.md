# Protocol adapter framework

Adapters live in `lib/protocols/` and register through `lib/protocols/registry.ts`.

## Interface

Each adapter implements:

- `validateConfig`
- optional `normalizeTelemetry`
- optional `testConnectivity` / `healthCheck`

Statuses:

| Status | Meaning |
|--------|---------|
| `implemented` | Cloud path works (e.g. HTTP ingest) |
| `gateway_required` | Config + decode ready; live sockets on gateway |
| `stub` | Interface present; needs vendor/lib work |
| `planned` | Documented intent only |

## Adding a vendor / protocol

1. Create `lib/protocols/adapters/<name>.ts`
2. Register in `registry.ts`
3. Add Zod config schema + unit tests
4. If sockets are needed, implement gateway connector (never in serverless)
5. Update `docs/hardware-compatibility.md`
6. Only then claim support in UI copy
