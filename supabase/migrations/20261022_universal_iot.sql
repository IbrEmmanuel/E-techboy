-- Additive EnergyMonitor universal IoT schema (PostgreSQL).
-- Prisma remains the primary ORM for this app. Apply via `prisma db push` / migrate,
-- or adapt these statements for Supabase. Enable RLS per-tenant when migrating auth.

-- Example RLS posture (enable only after org/site membership tables are populated):
-- ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY device_site_members ON "Device"
--   USING (EXISTS (
--     SELECT 1 FROM "SiteMembership" m
--     WHERE m."siteId" = "Device"."siteId" AND m."userId" = auth.uid()::text
--   ));

-- Prefer generating exact DDL from Prisma:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script

COMMENT ON SCHEMA public IS 'EnergyMonitor: use Prisma migrations as source of truth; this file documents Supabase/RLS intent.';
