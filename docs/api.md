# API overview (v1)

Authenticated operator APIs use the session cookie. Device/gateway APIs use `Authorization: Bearer <publicId>.<secret>`.

## Core (existing)

- `POST /api/v1/auth/login`
- `POST /api/v1/telemetry` — legacy ESP energy meter ingest
- `GET /api/v1/devices?siteId=`
- `GET /api/v1/measurements/latest?siteId=`
- `GET /api/v1/analytics?siteId=&from=&to=`
- `GET /api/v1/alerts?siteId=`

## Universal platform

- `GET /api/v1/protocols`
- `POST /api/v1/protocols/test` — config validation (does not fabricate live hardware success)
- `GET /api/v1/device-profiles`
- `POST /api/v1/telemetry/universal` — normalized measurements
- `GET|POST /api/v1/gateways?siteId=`
- `POST /api/v1/gateways/heartbeat` — gateway auth
- `GET|POST /api/v1/automation/rules?siteId=`
- `POST /api/v1/automation/rules/:id/simulate`
- `GET /api/v1/smart-grid?siteId=`
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/paystack/webhook` — signature required

Commands never report success solely because they were queued; gateways/devices must acknowledge.
