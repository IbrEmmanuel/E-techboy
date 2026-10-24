import type { DeviceCategory, ProtocolKind } from "@prisma/client";

export type DeviceProfileSeed = {
  manufacturer: string;
  model: string;
  category: DeviceCategory;
  protocol: ProtocolKind;
  description: string;
  capabilities: Record<string, unknown>;
  registerMap?: unknown;
  docsUrl?: string;
};

export const DEVICE_PROFILES: DeviceProfileSeed[] = [
  {
    manufacturer: "Espressif",
    model: "ESP32 + PZEM-004T",
    category: "ESP32",
    protocol: "HTTP",
    description: "ESP32 energy meter publishing authenticated HTTPS telemetry.",
    capabilities: {
      measurements: ["voltage", "current", "active_power", "energy", "power_factor", "frequency"],
      commands: ["REQUEST_STATUS", "ROTATE_CREDENTIAL"],
    },
  },
  {
    manufacturer: "Espressif",
    model: "ESP32-S3 MQTT Bridge",
    category: "ESP32",
    protocol: "MQTT",
    description: "ESP32-S3 publishing MQTT telemetry via gateway/broker bridge.",
    capabilities: {
      measurements: ["voltage", "current", "active_power"],
      commands: ["REQUEST_STATUS"],
      requiresGateway: true,
    },
  },
  {
    manufacturer: "Espressif",
    model: "ESP8266 NodeMCU",
    category: "ESP8266",
    protocol: "HTTP",
    description: "ESP8266 with memory/TLS limitations; prefer short HTTPS posts.",
    capabilities: {
      measurements: ["voltage", "current", "active_power", "energy"],
      limitations: ["Limited TLS buffer", "Prefer HTTP ingest over heavy MQTT stacks"],
    },
  },
  {
    manufacturer: "Raspberry Pi",
    model: "Gateway Agent",
    category: "RASPBERRY_PI",
    protocol: "HTTP",
    description: "Edge gateway for Modbus/MQTT/serial bridging and store-and-forward.",
    capabilities: { role: "gateway", protocols: ["modbus_tcp", "modbus_rtu", "mqtt"] },
  },
  {
    manufacturer: "Generic",
    model: "Modbus TCP Meter",
    category: "SMART_METER",
    protocol: "MODBUS_TCP",
    description: "Generic Modbus TCP power meter with configurable register map.",
    capabilities: { readOnlyDefault: true, requiresGateway: true },
    registerMap: [
      { key: "voltage", address: 0, type: "uint16", scale: 0.1, unit: "V" },
      { key: "current", address: 1, type: "uint16", scale: 0.01, unit: "A" },
      { key: "active_power", address: 2, type: "uint32", count: 2, scale: 1, unit: "W" },
    ],
  },
  {
    manufacturer: "Generic",
    model: "Solar Inverter (Vendor API)",
    category: "SOLAR_INVERTER",
    protocol: "VENDOR_API",
    description: "Placeholder for vendor cloud APIs (Sungrow, Growatt, etc.) — validate per vendor.",
    capabilities: { stub: true, measurements: ["solar_power", "energy_today"] },
  },
  {
    manufacturer: "Generic",
    model: "Battery BMS",
    category: "BMS",
    protocol: "MQTT",
    description: "BMS publishing SoC and charge status over MQTT via gateway.",
    capabilities: { measurements: ["battery_soc", "battery_power", "charging"], requiresGateway: true },
  },
  {
    manufacturer: "Generic",
    model: "Industrial PLC (Modbus)",
    category: "PLC",
    protocol: "MODBUS_TCP",
    description: "PLC telemetry via Modbus TCP gateway. Not a substitute for certified safety systems.",
    capabilities: { readOnlyDefault: true, requiresGateway: true, control: "explicit_allowlist_only" },
  },
  {
    manufacturer: "Custom",
    model: "Custom Device",
    category: "CUSTOM",
    protocol: "CUSTOM",
    description: "Any device that implements the normalized telemetry API contract.",
    capabilities: { measurements: "dynamic" },
  },
];

export const DEVICE_CATEGORIES: { id: DeviceCategory; label: string; guidance: string }[] = [
  { id: "ESP32", label: "ESP32 / ESP32-S3", guidance: "Use HTTPS ingest or MQTT via broker/gateway." },
  { id: "ESP8266", label: "ESP8266 / NodeMCU", guidance: "Prefer HTTPS; watch TLS memory limits." },
  { id: "RASPBERRY_PI", label: "Raspberry Pi / Linux edge", guidance: "Install the gateway agent with systemd." },
  { id: "PLC", label: "Industrial PLC / PAC", guidance: "Gateway required. Read-only by default." },
  { id: "SMART_METER", label: "Smart meter", guidance: "Modbus/MQTT/HTTP depending on model." },
  { id: "POWER_ANALYZER", label: "Power analyzer", guidance: "Map registers or vendor API carefully." },
  { id: "SOLAR_INVERTER", label: "Solar inverter", guidance: "Often vendor API or Modbus; validate model." },
  { id: "BMS", label: "Battery management", guidance: "SoC and charge status via supported protocol." },
  { id: "CHARGE_CONTROLLER", label: "Charge controller", guidance: "Gateway or vendor API typically required." },
  { id: "SMART_GRID", label: "Smart-grid / microgrid", guidance: "Authorized interfaces only; no utility claims." },
  { id: "SENSOR", label: "Industrial sensor", guidance: "MQTT/Modbus/HTTP via gateway as needed." },
  { id: "RELAY", label: "Relay", guidance: "Control commands require allowlist + approval." },
  { id: "ACTUATOR", label: "Actuator", guidance: "Never bypass local interlocks." },
  { id: "IO_MODULE", label: "Digital/analog I/O", guidance: "Gateway Modbus or vendor driver." },
  { id: "GATEWAY", label: "Gateway", guidance: "Registers as gateway identity, not a meter." },
  { id: "CUSTOM", label: "Custom hardware", guidance: "Implement documented API/protocol contract." },
];
