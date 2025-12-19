/**
 * Redis connection utility for ProfRater
 * Uses ioredis for reliable Redis operations
 */

import Redis from 'ioredis';
import { Job } from './types';

// Singleton Redis client
let redis: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  // Parse Redis URL to detect if SSL/TLS is needed
  const usesTLS = redisUrl.startsWith('rediss://');

  // Configure Redis with conditional TLS
  redis = new Redis(redisUrl, {
    tls: usesTLS ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: false
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log(`✅ Redis connected (${usesTLS ? 'with TLS' : 'without TLS'})`);
  });

  return redis;
}

/**
 * Get a job from Redis by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const client = getRedisClient();
  const jobStr = await client.get(jobId);

  if (!jobStr) {
    return null;
  }

  return JSON.parse(jobStr) as Job;
}

/**
 * Set a job in Redis
 */
export async function setJob(jobId: string, job: Job): Promise<void> {
  const client = getRedisClient();
  await client.set(jobId, JSON.stringify(job));
}

/**
 * Delete a job from Redis
 */
export async function deleteJob(jobId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(jobId);
}

/**
 * Set a job with TTL (Time To Live) in seconds
 */
export async function setJobWithTTL(jobId: string, job: Job, ttlSeconds: number): Promise<void> {
  const client = getRedisClient();
  await client.set(jobId, JSON.stringify(job), 'EX', ttlSeconds);
}
