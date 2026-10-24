# Hardware compatibility matrix

Compatibility depends on interface, protocol, firmware, gateway, vendor API, and documentation. **Not every device is automatically compatible.**

| Category | Typical path | Status in this build |
|----------|--------------|----------------------|
| ESP32 / ESP32-S3 | HTTPS ingest / MQTT via broker+gateway | Implemented (HTTP) + gateway MQTT bridge |
| ESP8266 / NodeMCU | HTTPS (watch TLS RAM) | Example firmware provided |
| Raspberry Pi edge | Gateway agent | Agent foundation implemented |
| Modbus TCP meters/PLCs | Gateway poll + register map | Config + decode tested; live I/O needs gateway+device |
| Modbus RTU | Gateway serial | Config validated; needs USB-RS485 |
| OPC UA | Gateway + certs | Stub |
| BACnet/IP | Gateway | Stub |
| LoRaWAN | Network server webhook | Planned |
| Zigbee / Thread / BLE | Local radio gateway | Planned |
| Vendor inverter APIs | Per-vendor adapter | Stub scaffold |
| Utility smart-grid | Authorized utility interface only | Not claimed |

## Tested without physical hardware

- Protocol config validation
- Telemetry normalization
- Modbus register decoding
- Automation dry-run
- HTTP telemetry API (with simulator script)
