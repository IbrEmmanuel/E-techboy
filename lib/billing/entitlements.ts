import type { SubscriptionTier } from "@prisma/client";

export type Entitlements = {
  tier: SubscriptionTier;
  maxDevices: number;
  maxSites: number;
  maxGateways: number;
  historyDays: number;
  gatewayIntegrations: boolean;
  industrialProtocols: boolean;
  advancedAudit: boolean;
  automationControl: boolean;
  realDevices: boolean;
};

const PLANS: Record<SubscriptionTier, Entitlements> = {
  FREE_DEMO: {
    tier: "FREE_DEMO",
    maxDevices: 3,
    maxSites: 1,
    maxGateways: 0,
    historyDays: 7,
    gatewayIntegrations: false,
    industrialProtocols: false,
    advancedAudit: false,
    automationControl: false,
    realDevices: false,
  },
  IOT_STARTER: {
    tier: "IOT_STARTER",
    maxDevices: 10,
    maxSites: 2,
    maxGateways: 1,
    historyDays: 30,
    gatewayIntegrations: true,
    industrialProtocols: false,
    advancedAudit: false,
    automationControl: false,
    realDevices: true,
  },
  PROFESSIONAL: {
    tier: "PROFESSIONAL",
    maxDevices: 50,
    maxSites: 10,
    maxGateways: 5,
    historyDays: 365,
    gatewayIntegrations: true,
    industrialProtocols: false,
    advancedAudit: true,
    automationControl: true,
    realDevices: true,
  },
  INDUSTRIAL: {
    tier: "INDUSTRIAL",
    maxDevices: 200,
    maxSites: 50,
    maxGateways: 25,
    historyDays: 730,
    gatewayIntegrations: true,
    industrialProtocols: true,
    advancedAudit: true,
    automationControl: true,
    realDevices: true,
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    maxDevices: 10_000,
    maxSites: 1000,
    maxGateways: 500,
    historyDays: 3650,
    gatewayIntegrations: true,
    industrialProtocols: true,
    advancedAudit: true,
    automationControl: true,
    realDevices: true,
  },
};

export function entitlementsFor(tier: SubscriptionTier = "FREE_DEMO"): Entitlements {
  return PLANS[tier];
}

export function listPlans() {
  return (Object.keys(PLANS) as SubscriptionTier[]).map((tier) => {
    const plan = PLANS[tier];
    return {
      ...plan,
      name: {
        FREE_DEMO: "Free Demo",
        IOT_STARTER: "IoT Starter",
        PROFESSIONAL: "Professional",
        INDUSTRIAL: "Industrial",
        ENTERPRISE: "Enterprise",
      }[tier],
      priceNote: "Configurable; Paystack for eligible Nigerian customers (server-side + webhook verification).",
    };
  });
}

export function assertWithinLimit(current: number, max: number, resource: string) {
  if (current >= max) {
    throw new Error(`${resource} limit reached for current subscription (${max}).`);
  }
}
