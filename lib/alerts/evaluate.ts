import Decimal from "decimal.js";
import type { AlertType, MeasurementQuality } from "@prisma/client";

export type AlertRuleInput = {
  id: string;
  type: AlertType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  enabled: boolean;
  voltageHighV: Decimal.Value | null;
  voltageLowV: Decimal.Value | null;
  currentHighA: Decimal.Value | null;
  powerHighW: Decimal.Value | null;
  energyHighKwh: Decimal.Value | null;
  hysteresisPercent: Decimal.Value;
  sustainSeconds: number;
  cooldownSeconds: number;
};

export type ReadingInput = {
  voltageV: number;
  currentA: number;
  activePowerW: number;
  energyWh: number;
  quality: MeasurementQuality;
  recordedAt: Date;
};

export type OpenAlert = {
  fingerprint: string;
  type: AlertType;
  lastSeenAt: Date;
  openedAt: Date;
};

export type AlertDecision =
  | { action: "open" | "refresh"; type: AlertType; fingerprint: string; title: string; message: string; value: number; unit: string; severity: AlertRuleInput["severity"] }
  | { action: "resolve"; fingerprint: string }
  | { action: "ignore" };

function hystereticExceeded(value: number, threshold: number, hysteresisPercent: number, currentlyOpen: boolean) {
  if (currentlyOpen) {
    return value >= threshold * (1 - hysteresisPercent / 100);
  }
  return value >= threshold;
}

function hystereticUnderrun(value: number, threshold: number, hysteresisPercent: number, currentlyOpen: boolean) {
  if (currentlyOpen) {
    return value <= threshold * (1 + hysteresisPercent / 100);
  }
  return value <= threshold;
}

export function fingerprintFor(deviceId: string, type: AlertType, ruleId?: string) {
  return `${deviceId}:${type}:${ruleId ?? "default"}`;
}

export function evaluateReading(params: {
  deviceId: string;
  reading: ReadingInput;
  rules: AlertRuleInput[];
  openAlerts: OpenAlert[];
  dailyEnergyKwh?: number;
}): AlertDecision[] {
  const decisions: AlertDecision[] = [];
  const { reading, deviceId, rules, openAlerts } = params;
  const openByFp = new Map(openAlerts.map((a) => [a.fingerprint, a]));

  if (reading.quality === "INVALID") {
    const fp = fingerprintFor(deviceId, "INVALID_MEASUREMENT");
    decisions.push({
      action: openByFp.has(fp) ? "refresh" : "open",
      type: "INVALID_MEASUREMENT",
      fingerprint: fp,
      title: "Invalid measurement",
      message: "The meter reported an invalid sample.",
      value: 0,
      unit: "",
      severity: "WARNING",
    });
  }

  for (const rule of rules.filter((r) => r.enabled)) {
    const hyst = Number(rule.hysteresisPercent);
    const fp = fingerprintFor(deviceId, rule.type, rule.id);
    const open = openByFp.get(fp);
    const openAge = open ? (reading.recordedAt.getTime() - open.openedAt.getTime()) / 1000 : 0;
    const sustained = !open || openAge >= rule.sustainSeconds;

    if (rule.type === "OVERVOLTAGE" && rule.voltageHighV != null) {
      const threshold = Number(rule.voltageHighV);
      const hit = hystereticExceeded(reading.voltageV, threshold, hyst, Boolean(open));
      if (hit && sustained) {
        decisions.push({
          action: open ? "refresh" : "open",
          type: rule.type,
          fingerprint: fp,
          title: "Overvoltage",
          message: `Voltage ${reading.voltageV.toFixed(1)} V exceeded ${threshold} V`,
          value: reading.voltageV,
          unit: "V",
          severity: rule.severity,
        });
      } else if (open && !hit) {
        decisions.push({ action: "resolve", fingerprint: fp });
      }
    }

    if (rule.type === "UNDERVOLTAGE" && rule.voltageLowV != null) {
      const threshold = Number(rule.voltageLowV);
      const hit = hystereticUnderrun(reading.voltageV, threshold, hyst, Boolean(open));
      if (hit && sustained) {
        decisions.push({
          action: open ? "refresh" : "open",
          type: rule.type,
          fingerprint: fp,
          title: "Undervoltage",
          message: `Voltage ${reading.voltageV.toFixed(1)} V dropped below ${threshold} V`,
          value: reading.voltageV,
          unit: "V",
          severity: rule.severity,
        });
      } else if (open && !hit) {
        decisions.push({ action: "resolve", fingerprint: fp });
      }
    }

    if (rule.type === "OVERCURRENT" && rule.currentHighA != null) {
      const threshold = Number(rule.currentHighA);
      const hit = hystereticExceeded(reading.currentA, threshold, hyst, Boolean(open));
      if (hit && sustained) {
        decisions.push({
          action: open ? "refresh" : "open",
          type: rule.type,
          fingerprint: fp,
          title: "Overcurrent",
          message: `Current ${reading.currentA.toFixed(2)} A exceeded ${threshold} A`,
          value: reading.currentA,
          unit: "A",
          severity: rule.severity,
        });
      } else if (open && !hit) {
        decisions.push({ action: "resolve", fingerprint: fp });
      }
    }

    if (rule.type === "EXCESSIVE_POWER" && rule.powerHighW != null) {
      const threshold = Number(rule.powerHighW);
      const hit = hystereticExceeded(reading.activePowerW, threshold, hyst, Boolean(open));
      if (hit && sustained) {
        decisions.push({
          action: open ? "refresh" : "open",
          type: rule.type,
          fingerprint: fp,
          title: "Excessive power",
          message: `Active power ${reading.activePowerW.toFixed(0)} W exceeded ${threshold} W`,
          value: reading.activePowerW,
          unit: "W",
          severity: rule.severity,
        });
      } else if (open && !hit) {
        decisions.push({ action: "resolve", fingerprint: fp });
      }
    }

    if (rule.type === "HIGH_ENERGY" && rule.energyHighKwh != null && params.dailyEnergyKwh != null) {
      const threshold = Number(rule.energyHighKwh);
      const hit = params.dailyEnergyKwh >= threshold;
      if (hit) {
        if (open) {
          const since = (reading.recordedAt.getTime() - open.lastSeenAt.getTime()) / 1000;
          if (since < rule.cooldownSeconds) {
            decisions.push({ action: "ignore" });
            continue;
          }
        }
        decisions.push({
          action: open ? "refresh" : "open",
          type: rule.type,
          fingerprint: fp,
          title: "High energy consumption",
          message: `Today's energy ${params.dailyEnergyKwh.toFixed(3)} kWh exceeded ${threshold} kWh`,
          value: params.dailyEnergyKwh,
          unit: "kWh",
          severity: rule.severity,
        });
      }
    }
  }

  return decisions.filter((d) => d.action !== "ignore");
}
