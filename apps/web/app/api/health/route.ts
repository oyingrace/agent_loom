import { isDatabaseConfigured } from "@agent-loom/database";
import { isRedisHealthy } from "@/lib/redis/client";

export async function GET() {
  const redisOk = await isRedisHealthy();

  return Response.json({
    ok: true,
    service: "web",
    databaseConfigured: isDatabaseConfigured(),
    redisOk
  });
}
