import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/security/hash";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  globalRole: Role;
};

function secretKey() {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createSession(user: SessionUser, meta?: { ip?: string; userAgent?: string }) {
  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });
  const jwt = await new SignJWT({ sub: user.id, sid: tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      if (typeof payload.sid === "string") {
        await prisma.session.deleteMany({ where: { tokenHash: payload.sid } });
      }
    } catch {
      // ignore invalid cookie
    }
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    const session = await prisma.session.findUnique({
      where: { tokenHash: payload.sid },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || session.userId !== payload.sub) {
      return null;
    }
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      globalRole: session.user.globalRole,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const { HttpError } = await import("@/lib/http");
    throw new HttpError("UNAUTHENTICATED", "Authentication required", 401);
  }
  return user;
}

export function hasCookieToken(token: string | undefined): boolean {
  return Boolean(token);
}
