import { createClient } from "redis";

export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: process.env.REDIS_URL
    ? undefined
    : {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
  password: process.env.REDIS_PASSWORD || undefined,
  database: Number(process.env.REDIS_DB ?? 0),
});

redis.on("error", (error) => {
  console.error("Redis client error:", error);
});

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
}
