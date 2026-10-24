"""
EnergyMonitor ESP8266 / NodeMCU MicroPython example.

ESP8266 has limited RAM/TLS capacity. Prefer short HTTPS POSTs and avoid
heavy MQTT client stacks unless you have validated heap headroom.

Configure secrets in secrets.py (not committed).
"""

import time
import ubinascii
import urandom
import urequests
import network

try:
    from secrets import WIFI_SSID, WIFI_PASSWORD, APP_BASE_URL, DEVICE_PUBLIC_ID, DEVICE_TOKEN
except ImportError as exc:
    raise SystemExit("Copy secrets.py.example to secrets.py") from exc


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        for _ in range(40):
            if wlan.isconnected():
                break
            time.sleep(0.25)
    return wlan.isconnected()


def uuid4():
    return "-".join(
        [
            ubinascii.hexlify(bytes([urandom.getrandbits(8) for _ in range(4)])).decode(),
            ubinascii.hexlify(bytes([urandom.getrandbits(8) for _ in range(2)])).decode(),
            "4" + ubinascii.hexlify(bytes([urandom.getrandbits(8)])).decode()[0:3],
            "a" + ubinascii.hexlify(bytes([urandom.getrandbits(8)])).decode()[0:3],
            ubinascii.hexlify(bytes([urandom.getrandbits(8) for _ in range(6)])).decode(),
        ]
    )


def post(voltage, current, power, energy_wh):
    # Use RTC/NTP in production for accurate timestamps.
    ts = "2026-10-22T12:00:00Z"
    body = {
        "deviceId": DEVICE_PUBLIC_ID,
        "eventId": uuid4(),
        "timestamp": ts,
        "schemaVersion": 1,
        "firmwareVersion": "0.1.0-esp8266",
        "simulated": False,
        "measurements": {
            "voltageV": voltage,
            "currentA": current,
            "activePowerW": power,
            "powerFactor": 0.95,
            "frequencyHz": 50.0,
            "energyWh": energy_wh,
            "quality": "GOOD",
        },
    }
    url = APP_BASE_URL.rstrip("/") + "/api/v1/telemetry"
    headers = {"Authorization": "Bearer " + DEVICE_TOKEN, "Content-Type": "application/json"}
    res = urequests.post(url, json=body, headers=headers)
    code = res.status_code
    res.close()
    return code


def main():
    if not connect_wifi():
        raise SystemExit("WiFi failed")
    energy = 0.0
    while True:
        voltage = 229.5
        current = 0.8
        power = voltage * current
        energy += power * (20.0 / 3600.0)
        try:
            print("POST", post(voltage, current, power, energy))
        except Exception as exc:
            print("error", exc)
        time.sleep(20)


if __name__ == "__main__":
    main()
