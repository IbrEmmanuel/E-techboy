"""
ESP32 MicroPython example posting normalized universal telemetry.
Endpoint: POST /api/v1/telemetry/universal
"""

import time
import urequests
import network

from secrets_mp import WIFI_SSID, WIFI_PASSWORD, APP_BASE_URL, DEVICE_TOKEN, DEVICE_PUBLIC_ID


def wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    while not wlan.isconnected():
        time.sleep(0.2)


def post_universal(measurements):
    body = {
        "device_id": DEVICE_PUBLIC_ID,
        "recorded_at": "2026-10-22T12:00:00Z",
        "schema_version": 1,
        "measurements": measurements,
        "metadata": {"firmware": "0.1.0-mpy", "gateway_id": None},
    }
    url = APP_BASE_URL.rstrip("/") + "/api/v1/telemetry/universal"
    headers = {"Authorization": "Bearer " + DEVICE_TOKEN, "Content-Type": "application/json"}
    r = urequests.post(url, json=body, headers=headers)
    code = r.status_code
    r.close()
    return code


wifi()
while True:
    print(
        post_universal(
            [
                {"key": "voltage", "value": 230.2, "unit": "V", "quality": "good"},
                {"key": "active_power", "value": 850.5, "unit": "W", "quality": "good"},
            ]
        )
    )
    time.sleep(15)
