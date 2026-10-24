import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(clientKey(request, "login"), 8, 10 * 60 * 1000);
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return jsonError("INVALID_CREDENTIALS", "Email or password is incorrect", 401);
    }
    await createSession(
      { id: user.id, email: user.email, name: user.name, globalRole: user.globalRole },
      { ip: request.headers.get("x-forwarded-for") ?? undefined, userAgent: request.headers.get("user-agent") ?? undefined },
    );
    await prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id },
    });
    return jsonOk({
      user: { id: user.id, email: user.email, name: user.name, role: user.globalRole },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
