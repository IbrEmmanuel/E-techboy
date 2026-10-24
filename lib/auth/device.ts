import "server-only";

import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { randomToken, safeEqual, sha256 } from "@/lib/security/hash";

export function issueDeviceSecret() {
  const secret = randomToken(32);
  return { secret, hash: sha256(secret) };
}

export async function authenticateDevice(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError("UNAUTHENTICATED", "Device bearer token required", 401);
  }
  const token = authorization.slice("Bearer ".length).trim();
  const [publicId, secret] = token.split(".");
  if (!publicId || !secret) {
    throw new HttpError("UNAUTHENTICATED", "Malformed device credential", 401);
  }
  const device = await prisma.device.findUnique({ where: { publicId } });
  if (!device || device.status === "REVOKED" || device.credentialRevokedAt) {
    throw new HttpError("UNAUTHENTICATED", "Device credential is invalid or revoked", 401);
  }
  if (!safeEqual(device.credentialHash, sha256(secret))) {
    throw new HttpError("UNAUTHENTICATED", "Device credential is invalid or revoked", 401);
  }
  return device;
}

export async function rotateDeviceCredential(deviceId: string) {
  const { secret, hash } = issueDeviceSecret();
  const device = await prisma.device.update({
    where: { id: deviceId },
    data: {
      credentialHash: hash,
      credentialVersion: { increment: 1 },
      credentialRevokedAt: null,
      status: "ACTIVE",
    },
  });
  return { device, secret };
}

export async function revokeDevice(deviceId: string) {
  return prisma.device.update({
    where: { id: deviceId },
    data: {
      status: "REVOKED",
      credentialRevokedAt: new Date(),
      credentialHash: sha256(randomToken(16)),
    },
  });
}
