import "server-only";

import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { randomToken, safeEqual, sha256 } from "@/lib/security/hash";

export function issueGatewaySecret() {
  const secret = randomToken(32);
  return { secret, hash: sha256(secret) };
}

export async function authenticateGateway(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError("UNAUTHENTICATED", "Gateway bearer token required", 401);
  }
  const token = authorization.slice("Bearer ".length).trim();
  const [publicId, secret] = token.split(".");
  if (!publicId || !secret) {
    throw new HttpError("UNAUTHENTICATED", "Malformed gateway credential", 401);
  }
  const gateway = await prisma.gateway.findUnique({ where: { publicId } });
  if (!gateway || gateway.status === "REVOKED" || gateway.credentialRevokedAt) {
    throw new HttpError("UNAUTHENTICATED", "Gateway credential is invalid or revoked", 401);
  }
  if (!safeEqual(gateway.credentialHash, sha256(secret))) {
    throw new HttpError("UNAUTHENTICATED", "Gateway credential is invalid or revoked", 401);
  }
  return gateway;
}
