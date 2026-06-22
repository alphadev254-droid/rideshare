import { Redis } from "ioredis";
import { env } from "./env.js";

let redisConnection: Redis | null = null;

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = env.REDIS_URL
      ? new Redis(env.REDIS_URL, redisOptions())
      : new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          ...redisOptions(),
        });

    redisConnection.on("error", (err: Error) => {
      console.error("[REDIS] Connection error:", err.message);
    });
  }

  return redisConnection;
}

function redisOptions() {
  return {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
}

export async function checkRedisConnection(): Promise<void> {
  const redis = getRedisConnection();
  if (redis.status === "wait") await redis.connect();
  const pong = await redis.ping();
  if (pong !== "PONG") throw new Error("Redis ping failed");
  console.log(`[REDIS] Connected to ${redisHostLabel()}`);
}

function redisHostLabel() {
  if (env.REDIS_URL) {
    try {
      const url = new URL(env.REDIS_URL);
      return `${url.hostname}:${url.port || "6379"}`;
    } catch {
      return "configured REDIS_URL";
    }
  }

  return `${env.REDIS_HOST}:${env.REDIS_PORT}`;
}

export async function closeRedisConnection(): Promise<void> {
  if (!redisConnection) return;
  await redisConnection.quit();
  redisConnection = null;
}
