import type json from '@redis/json';
import { Configuration, Redis } from './types.js';
import { createClient, RedisClientType } from 'redis';

export type RedisClient = RedisClientType<{ json: typeof json.default }>;

interface RedisClients {
  sourceRedisClient: RedisClient;
  targetRedisClient: RedisClient;
}

/**
 * Creates and connects to two Redis clients based on the provided configuration.
 *
 * @param {Configuration} redConfig - The configuration for the Redis instances.
 * @returns {Promise<RedisClients>} A promise that resolves with the connected Redis clients.
 * @throws {Error} If there is an error while connecting to the Redis instances.
 */
export async function clients(redConfig: Configuration): Promise<RedisClients> {
  let sourceRedisClient: RedisClient;
  let targetRedisClient: RedisClient;

  try {
    sourceRedisClient = createClient(createRedisClientOptions(redConfig.sourceRedis));
    targetRedisClient = createClient(createRedisClientOptions(redConfig.targetRedis));

    await sourceRedisClient.connect();
    await targetRedisClient.connect();

    return { sourceRedisClient, targetRedisClient };
  } catch (err) {
    console.error(`Error while connecting with redis: ${(err as Error).message}`, (err as Error).stack);
    process.exit(1);
  }
}

/**
 * Scans for keys in a Redis instance that match a given pattern.
 *
 * @param {RedisClient} client - The Redis client to scan.
 * @param {string} [pattern='*'] - The pattern to match keys against.
 * @param {number} [count=25000] - The number of keys to scan at once.
 * @returns {Promise<string[]>} A promise that resolves with the matching keys.
 */
export async function scanForKeys(
  client: RedisClient,
  pattern: string = '*',
  count: number = 25000
): Promise<string[]> {
  const keys: string[] = [];
  for await (const key of client.scanIterator({
    MATCH: pattern,
    COUNT: count,
  })) {
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param {string[]} array - The array to split.
 * @param {number} chunkSize - The size of each chunk.
 * @returns {string[][]} The array split into chunks.
 */
export function chunkArray(array: string[], chunkSize: number): string[][] {
  const chunkCount = Math.ceil(array.length / chunkSize);
  const chunks: string[][] = new Array(chunkCount);
  for (let i = 0, j = 0; i < array.length; i += chunkSize, j++) {
    chunks[j] = array.slice(i, i + chunkSize);
  }
  return chunks;
}

/**
 * Creates the options for a Redis client based on the provided configuration.
 *
 * @param {Redis} config - The configuration for the Redis instance.
 * @returns {Object} The options for the Redis client.
 */
function createRedisClientOptions(config: Redis): object {
  return {
    socket: {
      host: config.host,
      port: config.port,
    },
    password: config.password,
  };
}
