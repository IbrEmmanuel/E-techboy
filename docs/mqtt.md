# MQTT topic and payload contract

Persistent MQTT clients belong on the **gateway/worker**, not Vercel serverless functions.

## Topics (example)

```
{tenant}/{site}/{devicePublicId}/telemetry
{tenant}/{site}/{devicePublicId}/status
{tenant}/{site}/{devicePublicId}/command
{tenant}/{site}/{devicePublicId}/ack
```

## Telemetry payload

Prefer the universal normalized contract, then bridge to `POST /api/v1/telemetry/universal`:

```json
{
  "device_id": "device-001",
  "protocol": "mqtt",
  "recorded_at": "2026-10-22T12:00:00Z",
  "measurements": [
    { "key": "voltage", "value": 230.2, "unit": "V", "quality": "good" },
    { "key": "active_power", "value": 850.5, "unit": "W", "quality": "good" }
  ],
  "metadata": { "firmware": "1.0.0", "gateway_id": "gateway-001" }
}
```

## QoS and retained messages

- Default QoS 1 for telemetry
- Retained status messages optional (`online` / `offline` last-will)
- Command topics should not use retained messages

## Security

- Prefer `mqtts://` or `wss://`
- Per-device or per-gateway credentials
- Rotate and revoke credentials from the dashboard
