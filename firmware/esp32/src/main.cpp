/**
 * EnergyMonitor ESP32 sample (Arduino / PlatformIO).
 * Posts authenticated HTTPS telemetry to /api/v1/telemetry
 * Copy secrets.h.example → secrets.h (never commit real tokens).
 *
 * Production checklist:
 * - SNTP time sync for ISO-8601 timestamps
 * - UUID event IDs
 * - CA pinning instead of setInsecure()
 * - Replace mock measurements with PZEM-004T (or other) reads
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include "secrets.h"

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "0.2.0-dev"
#endif

void ensureTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  for (int i = 0; i < 40; i++) {
    time_t now = time(nullptr);
    if (now > 1700000000) return;
    delay(250);
  }
}

String iso8601Now() {
  time_t now = time(nullptr);
  struct tm tmInfo;
  gmtime_r(&now, &tmInfo);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmInfo);
  return String(buf);
}

String uuidV4() {
  char buf[40];
  snprintf(
    buf,
    sizeof(buf),
    "%08lx-%04lx-4%03lx-a%03lx-%012llx",
    (unsigned long)esp_random(),
    (unsigned long)(esp_random() & 0xffff),
    (unsigned long)(esp_random() & 0x0fff),
    (unsigned long)(esp_random() & 0x0fff),
    (unsigned long long)((((uint64_t)esp_random()) << 32) | esp_random())
  );
  return String(buf);
}

bool postTelemetry(float voltage, float current, float power, float pf, float freq, float energyWh) {
  WiFiClientSecure client;
  // Prefer client.setCACert(ROOT_CA) in production.
  client.setInsecure();
  HTTPClient http;
  String url = String(APP_BASE_URL) + "/api/v1/telemetry";
  if (!http.begin(client, url)) return false;

  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_PUBLIC_ID) + "\",";
  body += "\"eventId\":\"" + uuidV4() + "\",";
  body += "\"timestamp\":\"" + iso8601Now() + "\",";
  body += "\"schemaVersion\":1,";
  body += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  body += "\"simulated\":false,";
  body += "\"measurements\":{";
  body += "\"voltageV\":" + String(voltage, 3) + ",";
  body += "\"currentA\":" + String(current, 4) + ",";
  body += "\"activePowerW\":" + String(power, 3) + ",";
  body += "\"powerFactor\":" + String(pf, 4) + ",";
  body += "\"frequencyHz\":" + String(freq, 3) + ",";
  body += "\"energyWh\":" + String(energyWh, 3) + ",";
  body += "\"quality\":\"GOOD\"";
  body += "}}";

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int code = http.POST(body);
  Serial.printf("telemetry POST => %d\n", code);
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  ensureTime();
}

void loop() {
  // TODO: replace with PZEM-004T UART reads
  static float energyWh = 0;
  float voltage = 230.2f;
  float current = 1.10f;
  float power = voltage * current;
  float pf = 0.97f;
  float freq = 50.0f;
  energyWh += power * (15.0f / 3600.0f);

  if (WiFi.status() == WL_CONNECTED) {
    postTelemetry(voltage, current, power, pf, freq, energyWh);
  } else {
    Serial.println("WiFi disconnected");
  }
  delay(15000);
}
