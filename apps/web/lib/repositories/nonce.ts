import { randomUUID } from "crypto";
import { BaseRepository } from "./base";

export class NonceRepository extends BaseRepository {
  private readonly ttlSeconds: number;

  constructor(keyPrefix: string, ttlSeconds: number) {
    super(keyPrefix);
    this.ttlSeconds = ttlSeconds;
  }

  async generate(): Promise<string> {
    const nonce = randomUUID();
    const key = this.buildKey(nonce);
    await this.redis.set(key, "pending", "EX", this.ttlSeconds);
    return nonce;
  }

  async consume(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce);
    const script = `
      local value = redis.call('GET', KEYS[1])
      if value == 'pending' then
        redis.call('SET', KEYS[1], 'used', 'KEEPTTL')
        return 1
      end
      return 0
    `;
    const result = await this.redis.eval(script, 1, key);
    return result === 1;
  }

  async isValid(nonce: string): Promise<boolean> {
    const key = this.buildKey(nonce);
    const value = await this.redis.get(key);
    return value === "pending";
  }
}
