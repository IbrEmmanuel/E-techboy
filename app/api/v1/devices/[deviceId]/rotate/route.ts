import { requireDeviceAccess } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { rotateDeviceCredential } from "@/lib/auth/device";
import { handleRouteError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/db";

export async function POST(_: Request, context: { params: Promise<{ deviceId: string }> }) {
  try {
    const user = await requireUser();
    const { deviceId } = await context.params;
    await requireDeviceAccess(user, deviceId, "ADMIN");
    const { device, secret } = await rotateDeviceCredential(deviceId);
    await prisma.auditLog.create({
      data: { userId: user.id, action: "DEVICE_ROTATE", entityType: "Device", entityId: deviceId },
    });
    return jsonOk({
      publicId: device.publicId,
      credentialVersion: device.credentialVersion,
      token: `${device.publicId}.${secret}`,
      note: "Previous credentials are invalid after rotation.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
