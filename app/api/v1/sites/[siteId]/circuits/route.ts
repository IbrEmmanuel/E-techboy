import { requireUser } from "@/lib/auth/session";
import { requireSiteRole } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { handleRouteError, jsonOk } from "@/lib/http";
import { circuitCreateSchema } from "@/lib/validation/resources";

export async function GET(_: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const user = await requireUser();
    const { siteId } = await context.params;
    await requireSiteRole(user, siteId);
    const circuits = await prisma.circuit.findMany({ where: { siteId } });
    return jsonOk({ circuits });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const user = await requireUser();
    const { siteId } = await context.params;
    await requireSiteRole(user, siteId, "ADMIN");
    const body = circuitCreateSchema.parse(await request.json());
    const circuit = await prisma.circuit.create({ data: { ...body, siteId } });
    return jsonOk({ circuit }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
