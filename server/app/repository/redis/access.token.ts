import crypto from "node:crypto";
import { redis } from "../../redis";

export const ACCESS_TOKEN_LOCK_TTL_SECONDS = 90;
export const ACCESS_TOKEN_LOCK_RENEW_INTERVAL_MS = 30_000;

const RENEW_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("EXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

function lockKey(userId: string, jti: string) {
  return `locked cookies:${userId}:${jti}`;
}

export const AccessTokenRepository = {
  async lock(userId: string, jti: string): Promise<string | null> {
    const owner = crypto.randomUUID();
    const result = await redis.set(lockKey(userId, jti), owner, {
      NX: true,
      EX: ACCESS_TOKEN_LOCK_TTL_SECONDS,
    });

    return result === "OK" ? owner : null;
  },

  async renewLock(userId: string, jti: string, owner: string): Promise<boolean> {
    const result = await redis.eval(RENEW_LOCK_SCRIPT, {
      keys: [lockKey(userId, jti)],
      arguments: [owner, String(ACCESS_TOKEN_LOCK_TTL_SECONDS)],
    });

    return result === 1;
  },

  async unlock(userId: string, jti: string, owner: string): Promise<void> {
    await redis.eval(RELEASE_LOCK_SCRIPT, {
      keys: [lockKey(userId, jti)],
      arguments: [owner],
    });
  },
};
