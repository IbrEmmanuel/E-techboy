import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function POST() {
  try {
    const user = await getCurrentUser();
    await destroySession();
    if (user) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id },
      });
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
