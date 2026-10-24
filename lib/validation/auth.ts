import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  defaultSiteId: z.string().cuid().nullable().optional(),
  notifyEmail: z.boolean().optional(),
});
