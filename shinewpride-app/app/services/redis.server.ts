import IORedis from "ioredis";

const redisState = globalThis as typeof globalThis & {
  shinewprideRedis?: IORedis;
};

export function isQueueEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisConnection(): IORedis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redisState.shinewprideRedis) {
    redisState.shinewprideRedis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  return redisState.shinewprideRedis;
}

export function resetRedisConnectionForTests(): void {
  redisState.shinewprideRedis?.disconnect();
  redisState.shinewprideRedis = undefined;
}
