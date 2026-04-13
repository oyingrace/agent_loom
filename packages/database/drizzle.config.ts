import { existsSync } from "fs";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit does not load .env automatically. When cwd is `packages/database`,
 * `DATABASE_URL` in the repo root is still missing — load likely paths.
 */
const envCandidates = [
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env.local"),
  resolve(process.cwd(), "../.env"),
  resolve(process.cwd(), "../../.env.local"),
  resolve(process.cwd(), "../../.env")
];

for (const path of envCandidates) {
  if (existsSync(path)) {
    loadEnv({ path });
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run drizzle-kit commands.");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  }
});
