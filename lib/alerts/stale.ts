import "server-only";

import { prisma } from "@/lib/db";
import { fingerprintFor } from "@/lib/alerts/evaluate";
import { getEnv } from "@/lib/env";

export async function markStaleDevices() {
  const now = new Date();
  const defaultStale = getEnv().STALE_AFTER_SECONDS;
  const devices = await prisma.device.findMany({
    where: { status: { in: ["ACTIVE", "OFFLINE", "PROVISIONING"] } },
  });

  let stale = 0;
  for (const device of devices) {
    const threshold = device.staleAfterSeconds || defaultStale;
    const last = device.lastSeenAt;
    const isStale = !last || now.getTime() - last.getTime() > threshold * 1000;
    if (isStale && device.status === "ACTIVE") {
      await prisma.device.update({ where: { id: device.id }, data: { status: "OFFLINE" } });
    }
    if (isStale) {
      const fp = fingerprintFor(device.id, last ? "DEVICE_STALE" : "DEVICE_OFFLINE");
      const existing = await prisma.alert.findFirst({
        where: { fingerprint: fp, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      });
      if (!existing) {
        await prisma.alert.create({
          data: {
            siteId: device.siteId,
            deviceId: device.id,
            type: last ? "DEVICE_STALE" : "DEVICE_OFFLINE",
            severity: "WARNING",
            title: last ? "Stale telemetry" : "Device offline",
            message: last
              ? `No accepted reading for more than ${threshold} seconds.`
              : "Device has never reported telemetry.",
            fingerprint: fp,
          },
        });
        stale += 1;
      }
    } else {
      await prisma.alert.updateMany({
        where: {
          deviceId: device.id,
          type: { in: ["DEVICE_STALE", "DEVICE_OFFLINE"] },
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        data: { status: "RESOLVED", resolvedAt: now },
      });
    }
  }
  return { checked: devices.length, opened: stale };
}
