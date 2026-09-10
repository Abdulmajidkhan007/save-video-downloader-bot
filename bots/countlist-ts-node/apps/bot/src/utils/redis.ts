import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  if (!redis) {
    try {
      redis = new Redis(config.redis.url, {
        password: config.redis.password,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 3000,
        retryStrategy: (times) => {
          if (times > 3) return null; // stop retrying
          return Math.min(times * 500, 2000);
        },
      });
      redis.on('error', () => { redisAvailable = false; });
      redis.on('connect', () => {
        redisAvailable = true;
        logger.info('Redis connected');
      });
      redis.connect().catch(() => {
        redisAvailable = false;
        logger.warn('Redis unavailable — caching disabled, bot works without it');
      });
    } catch {
      logger.warn('Redis init failed — running without cache');
      return null;
    }
  }
  return redis;
}

export async function setCacheValue(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redisAvailable) return;
  try {
    await getRedis()?.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* silent */ }
}

export async function getCacheValue<T>(key: string): Promise<T | null> {
  if (!redisAvailable) return null;
  try {
    const val = await getRedis()?.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function deleteCacheValue(key: string): Promise<void> {
  if (!redisAvailable) return;
  try {
    await getRedis()?.del(key);
  } catch { /* silent */ }
}

export async function setUserState(telegramId: bigint, state: string, data?: unknown): Promise<void> {
  if (!redisAvailable) return;
  try {
    const key = `user:state:${telegramId}`;
    await getRedis()?.setex(key, 600, JSON.stringify({ state, data }));
  } catch { /* silent */ }
}

export async function getUserState(telegramId: bigint): Promise<{ state: string; data?: unknown } | null> {
  if (!redisAvailable) return null;
  try {
    const key = `user:state:${telegramId}`;
    const val = await getRedis()?.get(key);
    if (!val) return null;
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export async function clearUserState(telegramId: bigint): Promise<void> {
  if (!redisAvailable) return;
  try {
    await getRedis()?.del(`user:state:${telegramId}`);
  } catch { /* silent */ }
}
