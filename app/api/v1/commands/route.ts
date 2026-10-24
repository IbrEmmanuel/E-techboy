import { requireUser } from "@/lib/auth/session";
import { requireDeviceAccess } from "@/lib/auth/access";
import { authenticateDevice } from "@/lib/auth/device";
import { prisma } from "@/lib/db";
import { commandSchema } from "@/lib/validation/resources";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { asJson } from "@/lib/json";

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const device = await authenticateDevice(auth);
      const now = new Date();
      await prisma.deviceCommand.updateMany({
        where: { deviceId: device.id, status: "PENDING", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
      const commands = await prisma.deviceCommand.findMany({
        where: { deviceId: device.id, status: "PENDING", expiresAt: { gt: now } },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      return jsonOk({
        commands,
        note: "Authorized command records only. GPIO control is not exposed.",
      });
    }
    const user = await requireUser();
    const deviceId = new URL(request.url).searchParams.get("deviceId");
    if (!deviceId) return jsonError("VALIDATION_ERROR", "deviceId is required", 400);
    await requireDeviceAccess(user, deviceId);
    const commands = await prisma.deviceCommand.findMany({
      where: { deviceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return jsonOk({ commands });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const deviceId = new URL(request.url).searchParams.get("deviceId");
    if (!deviceId) return jsonError("VALIDATION_ERROR", "deviceId is required", 400);
    const device = await requireDeviceAccess(user, deviceId, "ADMIN");
    const body = commandSchema.parse(await request.json());
    const command = await prisma.deviceCommand.create({
      data: {
        siteId: device.siteId,
        deviceId: device.id,
        type: body.type,
        payload: asJson(body.payload ?? {}),
        expiresAt: new Date(Date.now() + body.expiresInSeconds * 1000),
        createdById: user.id,
      },
    });
    return jsonOk(
      {
        command,
        delivery: "record-only",
        note: "Commands are stored as authorized records. GPIO control is not exposed. MQTT delivery requires an external broker integration.",
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const device = await authenticateDevice(request.headers.get("authorization"));
    const body = (await request.json()) as { commandId?: string };
    if (!body.commandId) return jsonError("VALIDATION_ERROR", "commandId is required", 400);
    const command = await prisma.deviceCommand.findFirst({
      where: { id: body.commandId, deviceId: device.id },
    });
    if (!command) return jsonError("NOT_FOUND", "Command not found", 404);
    if (command.expiresAt < new Date()) {
      await prisma.deviceCommand.update({ where: { id: command.id }, data: { status: "EXPIRED" } });
      return jsonError("EXPIRED", "Command expired", 410);
    }
    const updated = await prisma.deviceCommand.update({
      where: { id: command.id },
      data: { status: "ACKNOWLEDGED", ackAt: new Date() },
    });
    return jsonOk({ command: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
