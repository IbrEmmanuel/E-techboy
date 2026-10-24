import { PrismaClient, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const ownerPassword = await bcrypt.hash("ChangeMeNow1!", 12);
  const otherPassword = await bcrypt.hash("ChangeMeNow1!", 12);

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Site Owner",
      passwordHash: ownerPassword,
      globalRole: "OWNER",
      preferences: { create: { theme: "system", notifyEmail: false } },
    },
  });

  const outsider = await prisma.user.upsert({
    where: { email: "outsider@example.com" },
    update: {},
    create: {
      email: "outsider@example.com",
      name: "Other Tenant",
      passwordHash: otherPassword,
      globalRole: "OPERATOR",
    },
  });

  const site = await prisma.site.upsert({
    where: { id: "clseed000000000000000001" },
    update: {},
    create: {
      id: "clseed000000000000000001",
      name: "Lab Workshop",
      timezone: "America/Los_Angeles",
      currency: "USD",
    },
  });

  const otherSite = await prisma.site.upsert({
    where: { id: "clseed000000000000000002" },
    update: {},
    create: {
      id: "clseed000000000000000002",
      name: "Outsider Site",
      timezone: "UTC",
      currency: "USD",
    },
  });

  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: owner.id, siteId: site.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, siteId: site.id, role: "OWNER" },
  });
  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: outsider.id, siteId: otherSite.id } },
    update: { role: "OWNER" },
    create: { userId: outsider.id, siteId: otherSite.id, role: "OWNER" },
  });

  const circuit = await prisma.circuit.upsert({
    where: { id: "clseed0000000000000000c1" },
    update: {},
    create: {
      id: "clseed0000000000000000c1",
      siteId: site.id,
      name: "Main feeder",
      phaseLabel: "L1",
    },
  });

  const publicId = "esp32_demo000001";
  const demoSecret = "demo-device-secret-do-not-use-in-prod";
  const device = await prisma.device.upsert({
    where: { publicId },
    update: {
      credentialHash: sha256(demoSecret),
      credentialRevokedAt: null,
      status: "ACTIVE",
      siteId: site.id,
      circuitId: circuit.id,
      name: "Workshop meter",
    },
    create: {
      publicId,
      name: "Workshop meter",
      siteId: site.id,
      circuitId: circuit.id,
      sensorModel: "PZEM-004T-V3",
      credentialHash: sha256(demoSecret),
      status: "ACTIVE",
      firmwareVersion: "0.1.0-dev",
    },
  });

  await prisma.tariff.createMany({
    data: [
      {
        siteId: site.id,
        name: "Standard",
        currency: "USD",
        ratePerKwh: new Prisma.Decimal("0.180000"),
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.alertRule.createMany({
    data: [
      {
        siteId: site.id,
        name: "Overvoltage",
        type: "OVERVOLTAGE",
        voltageHighV: new Prisma.Decimal("250"),
        hysteresisPercent: new Prisma.Decimal("2"),
        sustainSeconds: 0,
      },
      {
        siteId: site.id,
        name: "Undervoltage",
        type: "UNDERVOLTAGE",
        voltageLowV: new Prisma.Decimal("200"),
        hysteresisPercent: new Prisma.Decimal("2"),
        sustainSeconds: 0,
      },
    ],
    skipDuplicates: true,
  });

  const org = await prisma.organization.upsert({
    where: { slug: "lab-workshop" },
    update: {},
    create: { name: "Lab Workshop Org", slug: "lab-workshop" },
  });
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: { role: "OWNER" },
    create: { userId: owner.id, organizationId: org.id, role: "OWNER" },
  });
  await prisma.site.update({ where: { id: site.id }, data: { organizationId: org.id } });

  const plans = [
    { tier: "FREE_DEMO" as const, name: "Free Demo", priceMonthly: "0", maxDevices: 3, maxSites: 1, maxGateways: 0, historyDays: 7, featuresJson: { realDevices: false } },
    { tier: "IOT_STARTER" as const, name: "IoT Starter", priceMonthly: "15000", maxDevices: 10, maxSites: 2, maxGateways: 1, historyDays: 30, featuresJson: { realDevices: true } },
    { tier: "PROFESSIONAL" as const, name: "Professional", priceMonthly: "45000", maxDevices: 50, maxSites: 10, maxGateways: 5, historyDays: 365, featuresJson: { automationControl: true } },
    { tier: "INDUSTRIAL" as const, name: "Industrial", priceMonthly: "120000", maxDevices: 200, maxSites: 50, maxGateways: 25, historyDays: 730, featuresJson: { industrialProtocols: true } },
    { tier: "ENTERPRISE" as const, name: "Enterprise", priceMonthly: "0", maxDevices: 10000, maxSites: 1000, maxGateways: 500, historyDays: 3650, featuresJson: { custom: true } },
  ];
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: plan.tier },
      update: {
        name: plan.name,
        priceMonthly: new Prisma.Decimal(plan.priceMonthly),
        maxDevices: plan.maxDevices,
        maxSites: plan.maxSites,
        maxGateways: plan.maxGateways,
        historyDays: plan.historyDays,
        featuresJson: plan.featuresJson,
      },
      create: {
        tier: plan.tier,
        name: plan.name,
        currency: "NGN",
        priceMonthly: new Prisma.Decimal(plan.priceMonthly),
        maxDevices: plan.maxDevices,
        maxSites: plan.maxSites,
        maxGateways: plan.maxGateways,
        historyDays: plan.historyDays,
        featuresJson: plan.featuresJson,
      },
    });
  }

  const starter = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "IOT_STARTER" } });
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { planId: starter.id, tier: "IOT_STARTER", status: "active" },
    create: { organizationId: org.id, planId: starter.id, tier: "IOT_STARTER", status: "active" },
  });

  await prisma.deviceModelProfile.upsert({
    where: { manufacturer_model_protocol: { manufacturer: "Espressif", model: "ESP32 + PZEM-004T", protocol: "HTTP" } },
    update: {},
    create: {
      manufacturer: "Espressif",
      model: "ESP32 + PZEM-004T",
      category: "ESP32",
      protocol: "HTTP",
      description: "ESP32 energy meter via authenticated HTTPS",
      capabilities: { measurements: ["voltage", "current", "active_power", "energy"] },
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: {
      category: "ESP32",
      protocol: "HTTP",
      manufacturer: "Espressif",
      model: "ESP32 + PZEM-004T",
      demoMode: true,
      connectionState: "CONNECTED",
      lastSeenAt: new Date(),
      lastSuccessfulAt: new Date(),
    },
  });

  // Gateway for Modbus/MQTT edge path demos
  const gatewayPublicId = "gw_lab_pi_0001";
  const gatewaySecret = "demo-gateway-secret-do-not-use-in-prod";
  const gateway = await prisma.gateway.upsert({
    where: { publicId: gatewayPublicId },
    update: {
      status: "ONLINE",
      lastHeartbeatAt: new Date(),
      agentVersion: "0.1.0-seed",
      credentialHash: sha256(gatewaySecret),
    },
    create: {
      publicId: gatewayPublicId,
      siteId: site.id,
      name: "Lab Pi gateway",
      status: "ONLINE",
      platform: "raspberry-pi",
      agentVersion: "0.1.0-seed",
      lastHeartbeatAt: new Date(),
      credentialHash: sha256(gatewaySecret),
    },
  });
  await prisma.gatewayAssignment.upsert({
    where: { gatewayId_deviceId: { gatewayId: gateway.id, deviceId: device.id } },
    update: {},
    create: { gatewayId: gateway.id, deviceId: device.id },
  });
  await prisma.device.update({ where: { id: device.id }, data: { gatewayId: gateway.id } });

  // Live monitoring automation (not dry-run) so ingest creates executions + alerts
  const existingAuto = await prisma.automationRule.findFirst({
    where: { siteId: site.id, name: "High power monitoring" },
  });
  if (!existingAuto) {
    await prisma.automationRule.create({
      data: {
        siteId: site.id,
        name: "High power monitoring",
        kind: "MONITORING",
        enabled: true,
        dryRunDefault: false,
        requireApproval: false,
        triggerJson: {
          type: "measurement_threshold",
          measurementKey: "active_power",
          operator: "gt",
          value: 150,
        },
        conditionsJson: { logic: "and", items: [] },
        actionsJson: [
          {
            type: "create_alert",
            title: "High active power",
            message: "active_power exceeded monitoring threshold",
            severity: "WARNING",
          },
          {
            type: "log_event",
            title: "Power threshold crossed",
            message: "Logged by automation runner",
          },
        ],
      },
    });
  }

  // Seed ~24h of telemetry so dashboard/analytics/reports are immediately usable
  const readingCount = await prisma.telemetryReading.count({ where: { deviceId: device.id } });
  if (readingCount < 20) {
    const now = Date.now();
    let energy = 17_800;
    const legacyRows: Prisma.TelemetryReadingCreateManyInput[] = [];
    const universalRows: Prisma.UniversalMeasurementCreateManyInput[] = [];
    const snapshots: Prisma.GridSnapshotCreateManyInput[] = [];

    for (let i = 96; i >= 0; i--) {
      const recordedAt = new Date(now - i * 15 * 60 * 1000);
      const voltageV = 225 + Math.sin(i / 8) * 4;
      const currentA = 1.1 + Math.cos(i / 11) * 0.35;
      const powerFactor = 0.95;
      const activePowerW = voltageV * currentA * powerFactor;
      energy += activePowerW * (15 / 60);
      const eventId = `seed-${i.toString().padStart(4, "0")}`;

      legacyRows.push({
        deviceId: device.id,
        eventId,
        recordedAt,
        schemaVersion: 1,
        voltageV: new Prisma.Decimal(voltageV.toFixed(3)),
        currentA: new Prisma.Decimal(currentA.toFixed(4)),
        activePowerW: new Prisma.Decimal(activePowerW.toFixed(3)),
        powerFactor: new Prisma.Decimal(powerFactor.toFixed(4)),
        frequencyHz: new Prisma.Decimal("50.010"),
        energyWh: new Prisma.Decimal(energy.toFixed(3)),
        quality: "GOOD",
        simulated: true,
        firmwareVersion: "0.1.0-seed",
        units: {
          voltage: "V",
          current: "A",
          activePower: "W",
          energy: "Wh",
          frequency: "Hz",
          powerFactor: "1",
        },
      });

      for (const m of [
        { key: "voltage", value: voltageV, unit: "V" },
        { key: "current", value: currentA, unit: "A" },
        { key: "active_power", value: activePowerW, unit: "W" },
        { key: "power_factor", value: powerFactor, unit: "1" },
        { key: "frequency", value: 50.01, unit: "Hz" },
        { key: "energy", value: energy, unit: "Wh" },
        { key: "solar_power", value: 600 + Math.sin(i / 6) * 200, unit: "W" },
        { key: "battery_soc", value: 70 + Math.cos(i / 9) * 10, unit: "%" },
      ]) {
        universalRows.push({
          deviceId: device.id,
          eventId,
          protocol: "HTTP",
          recordedAt,
          key: m.key,
          valueNumber: Number(m.value.toFixed(3)),
          valueType: "NUMBER",
          unit: m.unit,
          quality: "GOOD",
          simulated: true,
        });
      }

      if (i % 4 === 0) {
        snapshots.push({
          siteId: site.id,
          recordedAt,
          voltageV: Number(voltageV.toFixed(2)),
          currentA: Number(currentA.toFixed(3)),
          frequencyHz: 50.01,
          activePowerW: Number(activePowerW.toFixed(1)),
          powerFactor,
          importEnergyKwh: Number((energy / 1000).toFixed(3)),
          exportEnergyKwh: Number(((energy / 1000) * 0.05).toFixed(3)),
          solarPowerW: Number((600 + Math.sin(i / 6) * 200).toFixed(1)),
          batterySocPct: Number((70 + Math.cos(i / 9) * 10).toFixed(1)),
          batteryPowerW: Number((Math.sin(i / 5) * 120).toFixed(1)),
          gridAvailable: true,
          inverterStatus: "ok",
          peakDemandW: Number((activePowerW * 1.15).toFixed(1)),
          metadata: { seeded: true, simulated: true },
        });
      }
    }

    await prisma.telemetryReading.createMany({ data: legacyRows, skipDuplicates: true });
    await prisma.universalMeasurement.createMany({ data: universalRows, skipDuplicates: true });
    await prisma.gridSnapshot.createMany({ data: snapshots, skipDuplicates: true });

    await prisma.deviceConnectionLog.create({
      data: {
        deviceId: device.id,
        gatewayId: gateway.id,
        state: "CONNECTED",
        message: "Seeded historical telemetry + grid snapshots",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Owner login: owner@example.com / ChangeMeNow1!");
  console.log("Outsider login: outsider@example.com / ChangeMeNow1!");
  console.log(`Dev device token (hashed in DB): ${publicId}.${demoSecret}`);
  console.log(`Dev gateway token: ${gatewayPublicId}.${gatewaySecret}`);
  console.log(`Random filler token sample: ${randomBytes(4).toString("hex")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
