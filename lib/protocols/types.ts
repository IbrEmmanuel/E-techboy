/**
 * Shared protocol adapter contracts for EnergyMonitor.
 * Persistent broker/serial/PLC sockets belong in the gateway worker — not Vercel serverless.
 */

export type ProtocolId =
  | "mqtt"
  | "http"
  | "websocket"
  | "modbus_tcp"
  | "modbus_rtu"
  | "opc_ua"
  | "bacnet_ip"
  | "lorawan"
  | "zigbee"
  | "thread"
  | "ble"
  | "can"
  | "vendor_api"
  | "custom";

export type CapabilityStatus = "implemented" | "gateway_required" | "stub" | "planned";

export type MeasurementQuality = "good" | "estimated" | "suspect" | "invalid";

export type NormalizedMeasurement = {
  key: string;
  value: number | boolean | string;
  unit?: string;
  quality?: MeasurementQuality;
  scale?: number;
};

export type NormalizedTelemetry = {
  device_id: string;
  protocol: ProtocolId;
  recorded_at: string;
  schema_version?: number;
  measurements: NormalizedMeasurement[];
  metadata?: Record<string, unknown>;
};

export type ConnectionStatus = {
  state: "unknown" | "connecting" | "connected" | "degraded" | "disconnected" | "error" | "revoked";
  lastSuccessfulAt?: string | null;
  lastError?: string | null;
  details?: Record<string, unknown>;
};

export type AdapterCapability = {
  discovery: boolean;
  telemetryRead: boolean;
  commands: boolean;
  writes: boolean;
  healthCheck: boolean;
  requiresGateway: boolean;
};

export type ProtocolDescriptor = {
  id: ProtocolId;
  name: string;
  status: CapabilityStatus;
  description: string;
  capabilities: AdapterCapability;
  notes: string[];
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type HealthCheckResult = {
  ok: boolean;
  message: string;
  checkedAt: string;
};

export type CommandRequest = {
  commandId: string;
  type: string;
  payload?: Record<string, unknown>;
  expiresAt: string;
};

export type CommandResult = {
  commandId: string;
  accepted: boolean;
  status: "pending" | "acknowledged" | "failed" | "expired" | "rejected";
  message?: string;
};

export interface ProtocolAdapter {
  readonly id: ProtocolId;
  readonly descriptor: ProtocolDescriptor;
  validateConfig(config: unknown): ValidationResult;
  normalizeTelemetry?(raw: unknown, deviceId: string): NormalizedTelemetry;
  healthCheck?(config: unknown): Promise<HealthCheckResult>;
  /** Serverless-safe: config-only connectivity test, never opens long-lived sockets here. */
  testConnectivity?(config: unknown): Promise<HealthCheckResult>;
}

export interface DeviceAdapter {
  readonly protocol: ProtocolId;
  getCapabilities(): AdapterCapability;
  mapMeasurements(raw: unknown): NormalizedMeasurement[];
}

export interface GatewayConnector {
  register(payload: unknown): Promise<{ gatewayId: string }>;
  heartbeat(gatewayId: string, health: unknown): Promise<void>;
  pullCommands(gatewayId: string): Promise<CommandRequest[]>;
  ackCommand(commandId: string, result: CommandResult): Promise<void>;
}

export interface TelemetryNormalizer {
  normalize(raw: unknown, deviceId: string, protocol: ProtocolId): NormalizedTelemetry;
}

export interface CommandExecutor {
  execute(request: CommandRequest, allowlist: string[]): Promise<CommandResult>;
}
