import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export function createDbClient(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });

  return drizzle(pool, {
    schema,
    casing: "snake_case"
  });
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
