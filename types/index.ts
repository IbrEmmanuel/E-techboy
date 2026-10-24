export type MetricKey =
  | "voltageV"
  | "currentA"
  | "activePowerW"
  | "energyKwh"
  | "powerFactor"
  | "frequencyHz";

export type LiveDeviceSnapshot = {
  device: {
    id: string;
    publicId: string;
    name: string;
    status: string;
    lastSeenAt: string | null;
    firmwareVersion: string | null;
    sensorModel: string;
  };
  reading: {
    eventId: string;
    recordedAt: string;
    voltageV: number;
    currentA: number;
    activePowerW: number;
    powerFactor: number;
    frequencyHz: number;
    energyWh: number;
    quality: string;
    simulated: boolean;
    units: unknown;
    source: "postgresql";
  } | null;
  stale: boolean;
};

export const LIVE_UPDATE_NOTE =
  "Live values prefer WebSocket fan-out from the realtime server; authenticated HTTP polling remains the fallback every few seconds.";
