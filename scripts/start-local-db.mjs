/**
 * Starts an embedded PostgreSQL for local development (no system Postgres required).
 * Keeps the process alive so Next.js can connect on 127.0.0.1:5432.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const databaseDir = path.join(root, ".pgdata");

const port = Number(process.env.PGPORT || 5432);
const user = process.env.PGUSER || "postgres";
const password = process.env.PGPASSWORD || "postgres";
const database = process.env.PGDATABASE || "energy";

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
});

async function main() {
  console.log(`[local-db] Initializing cluster in ${databaseDir} ...`);
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  } else {
    // Cluster already exists; initialise is idempotent on some versions, but skip if present.
    try {
      await pg.initialise();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already|exist/i.test(message)) throw error;
      console.log("[local-db] Using existing data directory");
    }
  }

  console.log(`[local-db] Starting PostgreSQL on port ${port} ...`);
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`[local-db] Created database "${database}"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/i.test(message)) {
      console.log(`[local-db] Database "${database}" already exists`);
    } else {
      console.warn("[local-db] createDatabase:", message);
    }
  }

  console.log(`[local-db] Ready — DATABASE_URL=postgresql://${user}:${password}@127.0.0.1:${port}/${database}`);
  console.log("[local-db] Keep this process running while you use the app.");
}

main().catch((error) => {
  console.error("[local-db] Failed:", error);
  process.exit(1);
});
