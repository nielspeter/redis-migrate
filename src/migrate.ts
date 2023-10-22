import ora from 'ora';
import { Configuration } from './types.js';
import { chunkArray, clients, RedisClient, scanForKeys } from './redis.js';

/**
 * Migrates data from one Redis instance to another.
 *
 * @param {Configuration} config - The configuration for the Redis instances.
 */
export async function migrate(config: Configuration) {
  const connectionSpinner = ora('Connecting to Redis instances...').start();

  const { targetRedisClient, sourceRedisClient } = await clients(config);

  connectionSpinner.succeed('Connected to Redis instances successfully');

  const migrationSpinner = ora('Starting data migration...').start();

  try {
    migrationSpinner.text =
      `... scanning for keys` + config.matchPattern ? ` using pattern '${config.matchPattern}'` : '!';
    const keys = await scanForKeys(sourceRedisClient, config.matchPattern);

    migrationSpinner.text = `Found ${keys.length} keys, starting migration...`;

    let migratedKeysCount = 0;
    const keyChunks = chunkArray(keys, config.chunkSize);

    for (const keyChunk of keyChunks) {
      const promises = keyChunk.map(processKey(sourceRedisClient, targetRedisClient));
      await Promise.allSettled(promises);
      migratedKeysCount += keyChunk.length;
      migrationSpinner.text = `Migrated ${migratedKeysCount} keys...`;
    }
    migrationSpinner.succeed(`Data migration completed successfully, migrated ${keys.length} keys.`);
  } catch (err) {
    migrationSpinner.fail(`Error: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    await sourceRedisClient.quit();
    await targetRedisClient.quit();
  }
}

/**
 * Processes a key from the old Redis instance and migrates it to the new one.
 *
 * @param {RedisClient} sourceRedisClient - The client connected to the old Redis instance.
 * @param {RedisClient} targetRedisClient - The client connected to the new Redis instance.
 * @returns {Function} A function that takes a key, retrieves its data from the old Redis instance, and stores it in the new one.
 */
function processKey(sourceRedisClient: RedisClient, targetRedisClient: RedisClient) {
  return async (key: string) => {
    try {
      const keyType = await sourceRedisClient.type(key);
      switch (keyType) {
        case 'string':
          const stringValue = await sourceRedisClient.get(key);
          await targetRedisClient.set(key, stringValue!);
          break;
        case 'hash':
          const hashValue = await sourceRedisClient.hGetAll(key);
          await targetRedisClient.hSet(key, hashValue);
          break;
        case 'list':
          const listValue = await sourceRedisClient.lRange(key, 0, -1);
          await targetRedisClient.lPush(key, listValue);
          break;
        case 'set':
          const setValue = await sourceRedisClient.sMembers(key);
          await targetRedisClient.sAdd(key, setValue);
          break;
        case 'zset':
          const zsetValue = await sourceRedisClient.zRangeWithScores(key, 0, -1);
          await targetRedisClient.zAdd(key, zsetValue);
          break;
        case 'ReJSON-RL':
          const jsonValue = await sourceRedisClient.json.get(key);
          await targetRedisClient.json.set(key, '$', jsonValue);
          break;
        default:
          console.warn(` Key '${key}', with key type '${keyType}' not handled!`);
      }

      const ttl = await sourceRedisClient.ttl(key);
      if (ttl > -1) {
        await targetRedisClient.expire(key, ttl);
      }
    } catch (err) {
      console.error(`Error processing key '${key}': ${(err as Error).message}`, (err as Error).stack);
    }
  };
}
