/**
 * Starts embedded Postgres, applies schema + seed once, then runs Next.js.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const databaseDir = path.join(root, ".pgdata");

const port = 5432;
const user = "postgres";
const password = "postgres";
const database = "energy";

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: process.env,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForDb(pg, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const client = pg.getPgClient();
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Database did not become ready in time");
}

async function main() {
  process.env.DATABASE_URL = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}?schema=public`;
  process.env.DIRECT_URL = process.env.DATABASE_URL;

  const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
  });

  console.log("[dev:all] Starting embedded PostgreSQL...");
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  } else {
    try {
      await pg.initialise();
    } catch {
      // existing cluster
    }
  }
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch {
    // already exists
  }
  await waitForDb(pg);
  console.log("[dev:all] Database ready");

  await run("npx", ["prisma", "db", "push", "--accept-data-loss"]);
  await run("npm", ["run", "db:seed"]);

  console.log("[dev:all] Starting realtime WebSocket on :3001 and Next.js on :3000");
  const realtime = spawn("npm", ["run", "realtime"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const next = spawn("npm", ["run", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const shutdown = async () => {
    realtime.kill("SIGTERM");
    next.kill("SIGTERM");
    try {
      await pg.stop();
    } catch {
      // ignore
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  next.on("exit", async (code) => {
    realtime.kill("SIGTERM");
    try {
      await pg.stop();
    } catch {
      // ignore
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[dev:all] Failed:", error);
  process.exit(1);
});
