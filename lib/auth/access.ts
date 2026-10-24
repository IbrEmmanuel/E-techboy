import "server-only";

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { SessionUser } from "@/lib/auth/session";

const rank: Record<Role, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export async function getSiteMembership(userId: string, siteId: string) {
  return prisma.siteMembership.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });
}

export function isRoleAtLeast(role: Role, minRole: Role) {
  return rank[role] >= rank[minRole];
}

export async function requireSiteRole(user: SessionUser, siteId: string, minRole: Role = "VIEWER") {
  const membership = await getSiteMembership(user.id, siteId);
  if (!membership || !isRoleAtLeast(membership.role, minRole)) {
    throw new HttpError("FORBIDDEN", "You do not have access to this site", 403);
  }
  return membership;
}

export async function requireDeviceAccess(user: SessionUser, deviceId: string, minRole: Role = "VIEWER") {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new HttpError("NOT_FOUND", "Device not found", 404);
  await requireSiteRole(user, device.siteId, minRole);
  return device;
}

export async function userSiteIds(userId: string): Promise<string[]> {
  const rows = await prisma.siteMembership.findMany({
    where: { userId },
    select: { siteId: true },
  });
  return rows.map((r) => r.siteId);
}
