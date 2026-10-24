import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { deviceCreateSchema } from "@/lib/validation/resources";
import { issueDeviceSecret } from "@/lib/auth/device";
import { getProtocolAdapter } from "@/lib/protocols/registry";
import { entitlementsFor, assertWithinLimit } from "@/lib/billing/entitlements";
import { encryptionConfigured, encryptSecret } from "@/lib/security/secrets";
import { asJson, asJsonOrUndefined } from "@/lib/json";

function protocolToAdapterId(protocol: string) {
  return protocol.toLowerCase();
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId);
    const devices = await prisma.device.findMany({
      where: { siteId },
      select: {
        id: true,
        publicId: true,
        name: true,
        status: true,
        connectionState: true,
        category: true,
        protocol: true,
        manufacturer: true,
        model: true,
        lastSeenAt: true,
        lastSuccessfulAt: true,
        lastError: true,
        firmwareVersion: true,
        sensorModel: true,
        circuitId: true,
        gatewayId: true,
        demoMode: true,
        writeEnabled: true,
        credentialVersion: true,
        credentialRevokedAt: true,
      },
    });
    return jsonOk({ devices });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const siteId = new URL(request.url).searchParams.get("siteId");
    if (!siteId) return jsonError("VALIDATION_ERROR", "siteId is required", 400);
    await requireSiteRole(user, siteId, "ADMIN");
    const body = deviceCreateSchema.parse(await request.json());

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { organization: { include: { subscription: true } } },
    });
    const entitlements = entitlementsFor(site?.organization?.subscription?.tier ?? "FREE_DEMO");
    const deviceCount = await prisma.device.count({ where: { siteId, status: { not: "REVOKED" } } });
    try {
      assertWithinLimit(deviceCount, entitlements.maxDevices, "Devices");
    } catch (e) {
      return jsonError("FORBIDDEN", e instanceof Error ? e.message : "Limit reached", 403);
    }
    if (!body.demoMode && !entitlements.realDevices) {
      return jsonError("FORBIDDEN", "Real devices require IoT Starter or higher. Use demoMode on Free Demo.", 403);
    }

    const protocol = body.protocol ?? "HTTP";
    const adapter = getProtocolAdapter(protocolToAdapterId(protocol));
    if (body.connectionConfig && adapter) {
      const validation = adapter.validateConfig(body.connectionConfig);
      if (!validation.ok) {
        return jsonError("VALIDATION_ERROR", "Protocol configuration invalid", 400, validation.errors);
      }
    }
    if (adapter?.descriptor.capabilities.requiresGateway && !body.gatewayId && !body.demoMode) {
      return jsonError(
        "VALIDATION_ERROR",
        `${adapter.descriptor.name} requires a paired gateway or local agent for live connectivity.`,
        400,
      );
    }
    if ((protocol === "MODBUS_TCP" || protocol === "MODBUS_RTU" || protocol === "OPC_UA") && !entitlements.industrialProtocols && !body.demoMode) {
      return jsonError("FORBIDDEN", "Industrial protocols require the Industrial or Enterprise plan", 403);
    }

    const { secret, hash } = issueDeviceSecret();
    const prefix =
      body.category === "ESP8266" ? "esp8266" : body.category === "RASPBERRY_PI" ? "rpi" : body.category === "PLC" ? "plc" : "dev";
    const publicId = `${prefix}_${nanoid(12)}`;

    let connectionConfigEnc: string | undefined;
    if (body.connectionConfig && encryptionConfigured()) {
      const enc = encryptSecret(JSON.stringify(body.connectionConfig));
      connectionConfigEnc = JSON.stringify(enc);
    }

    const device = await prisma.device.create({
      data: {
        publicId,
        name: body.name,
        siteId,
        circuitId: body.circuitId,
        gatewayId: body.gatewayId,
        profileId: body.profileId,
        category: body.category ?? "ESP32",
        protocol,
        manufacturer: body.manufacturer,
        model: body.model,
        sensorModel: body.sensorModel,
        staleAfterSeconds: body.staleAfterSeconds,
        credentialHash: hash,
        status: "PROVISIONING",
        demoMode: Boolean(body.demoMode),
        writeEnabled: Boolean(body.writeEnabled),
        capabilities: asJsonOrUndefined(body.capabilities),
        connectionConfigEnc,
        measurementDefs: body.measurementDefs
          ? {
              create: body.measurementDefs.map((d) => ({
                key: d.key,
                label: d.label,
                unit: d.unit,
                valueType: d.valueType,
                scale: d.scale,
                writable: d.writable,
              })),
            }
          : undefined,
        protocolConfig: body.connectionConfig
          ? {
              create: {
                protocol,
                capabilityStatus:
                  adapter?.descriptor.status === "implemented"
                    ? "IMPLEMENTED"
                    : adapter?.descriptor.status === "gateway_required"
                      ? "GATEWAY_REQUIRED"
                      : adapter?.descriptor.status === "stub"
                        ? "STUB"
                        : "PLANNED",
                configJson: asJson(sanitizeConfig(body.connectionConfig)),
              },
            }
          : undefined,
      },
      include: { protocolConfig: true, measurementDefs: true },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "DEVICE_REGISTER", entityType: "Device", entityId: device.id },
    });
    return jsonOk(
      {
        device: {
          id: device.id,
          publicId: device.publicId,
          name: device.name,
          sensorModel: device.sensorModel,
          category: device.category,
          protocol: device.protocol,
          demoMode: device.demoMode,
          connectionState: device.connectionState,
          requiresGateway: adapter?.descriptor.capabilities.requiresGateway ?? false,
        },
        credential: {
          token: `${device.publicId}.${secret}`,
          note: "Store this token only on the device/gateway. It will not be shown again. Authorization: Bearer <token>",
        },
        nextStep: adapter?.descriptor.capabilities.requiresGateway
          ? "Pair a gateway and run a real connectivity test before marking the device connected."
          : "Send authenticated telemetry or run Test connectivity from the integrations wizard.",
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

function sanitizeConfig(config: Record<string, unknown>) {
  const clone = { ...config };
  for (const key of Object.keys(clone)) {
    if (/password|secret|token|private|api[_-]?key/i.test(key)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}
