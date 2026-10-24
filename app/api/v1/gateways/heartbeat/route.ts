import { NextRequest } from "next/server";
import { authenticateGateway } from "@/lib/auth/gateway";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";
import { asJsonOrUndefined } from "@/lib/json";
import { gatewayHeartbeatSchema } from "@/lib/validation/resources";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(clientKey(request, "gateway-heartbeat"), 60, 60 * 1000);
    const gateway = await authenticateGateway(request.headers.get("authorization"));
    const body = gatewayHeartbeatSchema.parse(await request.json());
    const now = new Date();
    await prisma.gateway.update({
      where: { id: gateway.id },
      data: {
        status: "ONLINE",
        lastHeartbeatAt: now,
        agentVersion: body.agentVersion ?? gateway.agentVersion,
        metadata: asJsonOrUndefined(body.metadata),
      },
    });
    await prisma.gatewayHealthReport.create({
      data: {
        gatewayId: gateway.id,
        cpuPercent: body.cpuPercent,
        memPercent: body.memPercent,
        diskPercent: body.diskPercent,
        uptimeSec: body.uptimeSec,
        payload: asJsonOrUndefined(body.metadata),
        reportedAt: now,
      },
    });
    const pendingCommands = await prisma.deviceCommand.findMany({
      where: {
        siteId: gateway.siteId,
        status: "PENDING",
        expiresAt: { gt: now },
        approvalState: { in: ["NOT_REQUIRED", "APPROVED"] },
        device: { OR: [{ gatewayId: gateway.id }, { gatewayAssignments: { some: { gatewayId: gateway.id } } }] },
      },
      take: 50,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        deviceId: true,
        type: true,
        payload: true,
        expiresAt: true,
        device: { select: { publicId: true } },
      },
    });
    return jsonOk({
      ok: true,
      serverTime: now.toISOString(),
      commands: pendingCommands.map((c) => ({
        commandId: c.id,
        devicePublicId: c.device.publicId,
        type: c.type,
        payload: c.payload,
        expiresAt: c.expiresAt,
      })),
      note: "Commands are queued; success requires gateway execution acknowledgement.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
