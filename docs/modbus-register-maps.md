# Example Modbus register maps

Live Modbus TCP/RTU polling runs on the **gateway agent**. The cloud stores config and normalized readings.

## Example single-phase meter (Modbus TCP)

| Key | Address | Type | Scale | Unit |
|-----|---------|------|-------|------|
| voltage | 0 | uint16 | 0.1 | V |
| current | 1 | uint16 | 0.01 | A |
| active_power | 2 | uint32 (2 regs) | 1 | W |
| energy | 4 | uint32 | 0.001 | kWh |

JSON config fragment:

```json
{
  "host": "192.168.1.50",
  "port": 502,
  "unitId": 1,
  "byteOrder": "BE",
  "wordOrder": "AB",
  "writeEnabled": false,
  "registers": [
    { "key": "voltage", "address": 0, "type": "uint16", "scale": 0.1, "unit": "V" },
    { "key": "current", "address": 1, "type": "uint16", "scale": 0.01, "unit": "A" },
    { "key": "active_power", "address": 2, "type": "uint32", "count": 2, "scale": 1, "unit": "W" }
  ]
}
```

## Safety

- Read-only by default
- Writable registers require explicit authorization and allowlists
- Do not expose Modbus ports to the public internet
