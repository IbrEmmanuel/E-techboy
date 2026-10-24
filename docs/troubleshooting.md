# Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Device stays `PROVISIONING` / `UNKNOWN` | No successful ingest | Check token, TLS, timestamp, rate limits |
| “Simulated telemetry not accepted” | Production or flag off | Set `ALLOW_SIMULATED_TELEMETRY=true` only in development |
| Gateway create 403 | Plan entitlements | Free Demo cannot register live gateways |
| Modbus “connected” expected in UI after config test | Config test ≠ live poll | Run gateway on LAN and confirm heartbeats |
| Industrial protocol 403 | Plan tier | Industrial/Enterprise required for Modbus/OPC claims |
| Paystack webhook 401 | Bad signature / missing secret | Configure `PAYSTACK_WEBHOOK_SECRET` |
| Encryption errors storing config | Missing key | Set `CREDENTIALS_ENCRYPTION_KEY` (≥32 chars) |
| ESP8266 TLS failures | Heap limits | Shorten payloads; verify certs; prefer HTTP ingest patterns that fit RAM |
