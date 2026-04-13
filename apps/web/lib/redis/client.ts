import Redis from "ioredis";

let instance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!instance) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    instance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      }
    });

    instance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
  }

  return instance;
}

export async function closeRedisClient(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = null;
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
