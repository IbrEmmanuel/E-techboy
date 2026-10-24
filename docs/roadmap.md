# Roadmap — next implementation stages

1. **Gateway Modbus live poller** — add `modbus-serial` / TCP client in `gateway/` with store-and-forward (requires hardware or simulator).
2. **OPC UA adapter** — integrate a maintained client library behind gateway TLS + cert store.
3. **Supabase Auth migration** — optional path from app sessions to Supabase Auth + RLS (SQL starter in `supabase/migrations`).
4. **Vendor inverter adapters** — one vendor at a time with contract tests.
5. **LoRaWAN webhook ingest** — ChirpStack/TTN with per-tenant decoder plugins.
6. **Paystack checkout UI** — initialize transactions server-side after webhook path (already present).
7. **Node-RED connector** — authenticated event bridge (no arbitrary JS on app server).

Do not mark a protocol as supported until tests and a documented commissioning path exist.
