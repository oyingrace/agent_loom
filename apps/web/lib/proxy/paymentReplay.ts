import { getRedisClient } from "@/lib/redis/client";

const USED_PREFIX = "agent_loom:proxy:tx_used:";
const LOCK_PREFIX = "agent_loom:proxy:tx_lock:";

export async function isTxUsed(txHash: string): Promise<boolean> {
  const v = await getRedisClient().get(USED_PREFIX + txHash);
  return v != null;
}

export async function markTxUsed(
  txHash: string,
  ttlSeconds = 86400 * 7
): Promise<void> {
  await getRedisClient().set(USED_PREFIX + txHash, "1", "EX", ttlSeconds);
}

export async function acquireTxLock(
  txHash: string,
  ttlSeconds = 120
): Promise<boolean> {
  const ok = await getRedisClient().set(
    LOCK_PREFIX + txHash,
    "1",
    "EX",
    ttlSeconds,
    "NX"
  );
  return ok === "OK";
}

export async function releaseTxLock(txHash: string): Promise<void> {
  await getRedisClient().del(LOCK_PREFIX + txHash);
}
