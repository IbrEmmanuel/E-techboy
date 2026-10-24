# Security and industrial safety

## Application security

- TLS for client ↔ cloud and preferred for MQTT (`mqtts` / `wss`)
- Device and gateway credentials hashed at rest; connection secrets encrypted with AES-256-GCM when `CREDENTIALS_ENCRYPTION_KEY` is set
- Session cookies for operators; bearer tokens for devices/gateways
- Role-based site access (`OWNER` / `ADMIN` / `OPERATOR` / `VIEWER`)
- Input validation (Zod), rate limiting, audit logs
- Command allowlists, expiry, optional approval for CONTROL automation
- No arbitrary remote code execution from the cloud to gateways

## Industrial safety boundaries

Cloud automation is **not** a replacement for:

- PLC scan cycles
- Local interlocks
- Emergency stops
- Lockout/tagout
- Certified protection relays
- Automatic islanding / mains switching without certified equipment and engineering review

Default industrial mode is **read-only**. Writes require explicit configuration, entitlements, and authorization.

## Network discovery

Discovery (when implemented on a gateway) must only target explicitly authorized local networks. The hosted web app must not scan arbitrary external IPs.
