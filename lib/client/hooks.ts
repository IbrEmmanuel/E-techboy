"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/client/api";
import { useSiteRealtime } from "@/lib/client/realtime";
import type { LiveDeviceSnapshot } from "@/types";

export type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    sites: { id: string; name: string; role: string; timezone: string; currency: string }[];
    preferences: {
      theme: string;
      defaultSiteId: string | null;
      notifyEmail: boolean;
      livePollIntervalMs: number;
    } | null;
  };
};

export type LatestResponse = {
  devices: LiveDeviceSnapshot[];
  pollIntervalMs: number;
  note: string;
  realtimeStatus?: string;
};

export type AnalyticsResponse = {
  analytics: {
    timezone: string;
    currency: string;
    totals: {
      energyKwh: number;
      peakPowerW: number;
      avgPowerW: number;
      method: string;
      incomplete: boolean;
      resets: number;
      assumptions: string[];
    };
    daily: { day: string; energyKwh: number; peakPowerW: number; incomplete: boolean }[];
    monthly: { month: string; energyKwh: number; incomplete: boolean }[];
    cost: { amount: number; currency: string; estimated: boolean; incomplete: boolean };
    series: { t: string; w: number; simulated: boolean }[];
  };
};

export type AlertsResponse = {
  alerts: {
    id: string;
    type: string;
    severity: string;
    status: string;
    title: string;
    message: string;
    openedAt: string;
    device?: { name: string; publicId: string } | null;
  }[];
  openCount: number;
};

const fetcher = <T,>(url: string) => apiFetch<T>(url);

export function useMe() {
  return useSWR<MeResponse>("/api/v1/auth/me", fetcher);
}

export function useLatest(siteId: string | null) {
  const mutateRef = { current: null as null | (() => void) };

  const { status: realtimeStatus } = useSiteRealtime(siteId, (event) => {
    if (event.type === "telemetry" || event.type === "universal" || event.type === "device_status") {
      mutateRef.current?.();
    }
  });

  const swr = useSWR<LatestResponse>(
    siteId ? `/api/v1/measurements/latest?siteId=${siteId}` : null,
    fetcher,
    {
      // WebSocket push is primary when live; keep a slow HTTP safety poll.
      refreshInterval: () => (realtimeStatus === "live" ? 30_000 : 8_000),
    },
  );
  mutateRef.current = () => {
    void swr.mutate();
  };

  return {
    ...swr,
    realtimeStatus,
    data: swr.data
      ? {
          ...swr.data,
          note:
            realtimeStatus === "live"
              ? "Live WebSocket connected — updates push instantly; HTTP polling is backup."
              : realtimeStatus === "offline" || realtimeStatus === "reconnecting"
                ? "WebSocket offline — using authenticated HTTP polling until realtime reconnects."
                : swr.data.note,
          realtimeStatus,
        }
      : swr.data,
  };
}

export function useAnalytics(siteId: string | null, from: string, to: string) {
  return useSWR<AnalyticsResponse>(
    siteId
      ? `/api/v1/analytics?siteId=${siteId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null,
    fetcher,
  );
}

export function useAlerts(siteId: string | null) {
  const swr = useSWR<AlertsResponse>(siteId ? `/api/v1/alerts?siteId=${siteId}` : null, fetcher, {
    refreshInterval: 15000,
  });
  useSiteRealtime(siteId, (event) => {
    if (event.type === "telemetry" || event.type === "universal" || event.type === "alert") {
      void swr.mutate();
    }
  });
  return swr;
}

export function useDevices(siteId: string | null) {
  return useSWR<{
    devices: {
      id: string;
      publicId: string;
      name: string;
      status: string;
      connectionState?: string;
      category?: string;
      protocol?: string;
      manufacturer?: string | null;
      model?: string | null;
      lastSeenAt: string | null;
      lastSuccessfulAt?: string | null;
      lastError?: string | null;
      firmwareVersion: string | null;
      sensorModel: string;
      gatewayId?: string | null;
      demoMode?: boolean;
      credentialRevokedAt: string | null;
    }[];
  }>(siteId ? `/api/v1/devices?siteId=${siteId}` : null, fetcher);
}

export function useTariffs(siteId: string | null) {
  return useSWR<{
    tariffs: { id: string; name: string; currency: string; ratePerKwh: string; effectiveFrom: string }[];
  }>(siteId ? `/api/v1/tariffs?siteId=${siteId}` : null, fetcher);
}

export function useProtocols() {
  return useSWR<{
    protocols: {
      id: string;
      name: string;
      status: string;
      description: string;
      capabilities: Record<string, boolean>;
      notes: string[];
    }[];
    note: string;
  }>("/api/v1/protocols", fetcher);
}

export function useDeviceProfiles() {
  return useSWR<{
    categories: { id: string; label: string; guidance: string }[];
    profiles: {
      id: string;
      manufacturer: string;
      model: string;
      category: string;
      protocol: string;
      description: string;
    }[];
    compatibilityNote: string;
  }>("/api/v1/device-profiles", fetcher);
}

export function useGateways(siteId: string | null) {
  return useSWR<{
    gateways: {
      id: string;
      publicId: string;
      name: string;
      status: string;
      platform: string;
      agentVersion: string | null;
      lastHeartbeatAt: string | null;
    }[];
  }>(siteId ? `/api/v1/gateways?siteId=${siteId}` : null, fetcher);
}

export function useAutomationRules(siteId: string | null) {
  return useSWR<{
    rules: {
      id: string;
      name: string;
      kind: string;
      enabled: boolean;
      dryRunDefault: boolean;
      requireApproval: boolean;
      executions?: { id: string; status: string; startedAt: string; dryRun: boolean }[];
    }[];
    safety: string;
  }>(siteId ? `/api/v1/automation/rules?siteId=${siteId}` : null, fetcher);
}

export function useSmartGrid(siteId: string | null) {
  return useSWR<{
    snapshot: Record<string, unknown> | null;
    history: Record<string, unknown>[];
    derivedFromMeters: {
      voltageV: number;
      currentA: number;
      frequencyHz: number;
      activePowerW: number;
      powerFactor: number;
      sourceDevice: string;
      recordedAt: string;
      simulated: boolean;
    } | null;
    devices: { id: string; name: string; category: string; connectionState: string; demoMode: boolean }[];
    disclaimer: string;
  }>(siteId ? `/api/v1/smart-grid?siteId=${siteId}` : null, fetcher, { refreshInterval: 10000 });
}

export function useBillingPlans() {
  return useSWR<{
    plans: {
      tier: string;
      name: string;
      maxDevices: number;
      maxSites: number;
      maxGateways: number;
      historyDays: number;
      realDevices: boolean;
      industrialProtocols: boolean;
      priceNote: string;
    }[];
    note: string;
  }>("/api/v1/billing/plans", fetcher);
}
