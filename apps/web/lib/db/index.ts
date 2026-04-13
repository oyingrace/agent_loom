import { createDbClient } from "@agent-loom/database";

let instance: ReturnType<typeof createDbClient> | null = null;

export function getDb(): ReturnType<typeof createDbClient> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!instance) {
    instance = createDbClient(url);
  }
  return instance;
}
