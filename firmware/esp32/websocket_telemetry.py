"""
ESP32 MicroPython — live WebSocket telemetry to EnergyMonitor realtime server.

Requires: uwebsockets (or similar) on the device firmware image.

    ws_url = "ws://<host>:3001/device?token=<publicId.secret>"

Sends legacy energy frames every few seconds. Cloud stores via HTTP ingest
forwarding and fans out to dashboard WebSocket subscribers.
"""

# Example shape only — adapt imports to your MicroPython WebSocket client.
#
# import ujson, time, network
# from websocket import connect
#
# TOKEN = "esp32_demo000001.demo-device-secret-do-not-use-in-prod"
# WS = "ws://192.168.1.10:3001/device?token=" + TOKEN
#
# def main():
#     ws = connect(WS)
#     energy = 1000.0
#     while True:
#         energy += 1.2
#         ws.send(ujson.dumps({
#             "type": "telemetry",
#             "deviceId": TOKEN.split(".")[0],
#             "eventId": str(time.ticks_ms()),
#             "timestamp": "1970-01-01T00:00:00Z",  # prefer NTP ISO8601
#             "schemaVersion": 1,
#             "firmwareVersion": "esp32-ws-0.1",
#             "simulated": False,
#             "measurements": {
#                 "voltageV": 230.1,
#                 "currentA": 1.02,
#                 "activePowerW": 220.5,
#                 "powerFactor": 0.96,
#                 "frequencyHz": 50.0,
#                 "energyWh": energy,
#                 "quality": "GOOD",
#             },
#         }))
#         time.sleep(5)
#
# Prefer HTTPS HTTP POST to /api/v1/telemetry when WebSocket libs are unavailable.

DEVICE_WS_PATH = "/device"
CLOUD_HTTP_INGEST = "/api/v1/telemetry"
print("See comments in this file for MicroPython WebSocket wiring.")
