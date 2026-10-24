import { requireDeviceAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { revokeDevice } from "@/lib/auth/device";
import { handleRouteError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET(_: Request, context: { params: Promise<{ deviceId: string }> }) {
  try {
    const user = await requireUser();
    const { deviceId } = await context.params;
    const device = await requireDeviceAccess(user, deviceId);
    const [measurementDefs, latestUniversal, connectionLogs, protocolConfig, latestReading, commands] =
      await Promise.all([
        prisma.measurementDefinition.findMany({ where: { deviceId: device.id } }),
        prisma.universalMeasurement.findMany({
          where: { deviceId: device.id },
          orderBy: { recordedAt: "desc" },
          take: 50,
        }),
        prisma.deviceConnectionLog.findMany({
          where: { deviceId: device.id },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.protocolConfiguration.findUnique({ where: { deviceId: device.id } }),
        prisma.telemetryReading.findFirst({
          where: { deviceId: device.id },
          orderBy: { recordedAt: "desc" },
        }),
        prisma.deviceCommand.findMany({
          where: { deviceId: device.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);
    const latestByKey = new Map<string, (typeof latestUniversal)[number]>();
    for (const row of latestUniversal) {
      if (!latestByKey.has(row.key)) latestByKey.set(row.key, row);
    }
    return jsonOk({
      device: {
        id: device.id,
        publicId: device.publicId,
        name: device.name,
        status: device.status,
        connectionState: device.connectionState,
        category: device.category,
        protocol: device.protocol,
        manufacturer: device.manufacturer,
        model: device.model,
        gatewayId: device.gatewayId,
        lastSeenAt: device.lastSeenAt,
        lastSuccessfulAt: device.lastSuccessfulAt,
        lastError: device.lastError,
        firmwareVersion: device.firmwareVersion,
        sensorModel: device.sensorModel,
        demoMode: device.demoMode,
        writeEnabled: device.writeEnabled,
        capabilities: device.capabilities,
        credentialVersion: device.credentialVersion,
        revoked: Boolean(device.credentialRevokedAt),
      },
      measurementDefs,
      latestMeasurements: [...latestByKey.values()],
      latestReading: latestReading
        ? {
            voltageV: Number(latestReading.voltageV),
            currentA: Number(latestReading.currentA),
            activePowerW: Number(latestReading.activePowerW),
            powerFactor: Number(latestReading.powerFactor),
            frequencyHz: Number(latestReading.frequencyHz),
            energyWh: Number(latestReading.energyWh),
            recordedAt: latestReading.recordedAt,
            simulated: latestReading.simulated,
          }
        : null,
      commands,
      connectionLogs,
      protocolConfig: protocolConfig
        ? {
            protocol: protocolConfig.protocol,
            capabilityStatus: protocolConfig.capabilityStatus,
            lastTestAt: protocolConfig.lastTestAt,
            lastTestOk: protocolConfig.lastTestOk,
            lastTestMessage: protocolConfig.lastTestMessage,
            configJson: protocolConfig.configJson,
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ deviceId: string }> }) {
  try {
    const user = await requireUser();
    const { deviceId } = await context.params;
    await requireDeviceAccess(user, deviceId, "ADMIN");
    await revokeDevice(deviceId);
    await prisma.auditLog.create({
      data: { userId: user.id, action: "DEVICE_REVOKE", entityType: "Device", entityId: deviceId },
    });
    return jsonOk({ ok: true, revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
