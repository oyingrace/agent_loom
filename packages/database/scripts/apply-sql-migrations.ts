/**
 * Applies top-level `drizzle/*.sql` files in sort order.
 *
 * `drizzle-kit migrate` expects the newer layout (per-migration folders with
 * migration.sql + snapshot + meta/_journal). This repo uses hand-written SQL
 * files, so we apply them with the pg client instead.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** `packages/database` */
const dbPackageRoot = join(__dirname, "..");
/** Monorepo root (parent of `packages`) */
const repoRoot = join(__dirname, "..", "..");

for (const path of [
  join(repoRoot, ".env.local"),
  join(repoRoot, ".env"),
  join(dbPackageRoot, ".env.local"),
  join(dbPackageRoot, ".env"),
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env.local"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env.local"),
  resolve(process.cwd(), "../../.env")
]) {
  loadEnv({ path });
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Add it to .env at the repo root (agent_loom/.env)."
  );
  process.exit(1);
}

/** Always `packages/database/drizzle`, regardless of cwd. */
const migrationsDir = join(dbPackageRoot, "drizzle");

async function main(): Promise<void> {
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((d) => d.isFile() && d.name.endsWith(".sql"))
    .map((d) => d.name)
    .sort();

  if (files.length === 0) {
    console.error(`No .sql files found in ${migrationsDir}`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      const sql = readFileSync(fullPath, "utf8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
    }
    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
