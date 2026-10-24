import { z } from "zod";

export const idSchema = z.string().cuid();
export const publicDeviceIdSchema = z.string().min(8).max(64);
export const timezoneSchema = z.string().min(1).max(64);
export const currencySchema = z.string().length(3);

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine((v) => v.to.getTime() > v.from.getTime(), {
  message: "to must be after from",
});
