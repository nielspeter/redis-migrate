import ora from 'ora';
import { Configuration } from './types.js';
import { RedisJSON } from '@redis/json/dist/commands';
import { chunkArray, clients, RedisClient, scanForKeys } from './redis.js';

type KeyType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'ReJSON-RL';

type RedisString = string;
type RedisNumber = number;
type RedisList = string[];
type RedisSet = Set<string | Buffer>;
type RedisSortedSet = Array<{ score: number; value: string | Buffer }>;
type RedisHash = Record<string, string>;
type RedisJson = RedisJSON;

type RedisValue = RedisNumber | RedisString | RedisList | RedisSet | RedisSortedSet | RedisHash | RedisJson;
interface TransformedData {
  newKeyType: KeyType;
  newKey: string;
  newValue: RedisValue;
}
function passThrough(oldKey: string, oldValue: RedisValue, oldKeyType: KeyType): TransformedData {
  return {
    newKeyType: oldKeyType,
    newKey: oldKey,
    newValue: oldValue,
  };
}

/**
 * Migrates data from one Redis instance to another.
 *
 * @param {Configuration} config - The configuration for the Redis instances.
 * @param transformData
 */
export async function convert(
  config: Configuration,
  transformData: (oldKey: string, oldValue: RedisValue, oldKeyType: KeyType) => TransformedData = passThrough
) {
  const connectionSpinner = ora('Connecting to Redis instances...').start();

  const { targetRedisClient, sourceRedisClient } = await clients(config);

  connectionSpinner.succeed('Connected to Redis instances successfully');

  const migrationSpinner = ora('Starting data migration...').start();

  try {
    migrationSpinner.text =
      '... scanning for keys' + (config.matchPattern ? ` using pattern '${config.matchPattern}'` : '!');
    const keys = await scanForKeys(sourceRedisClient, config.matchPattern);

    migrationSpinner.text = `Found ${keys.length} keys, starting migration...`;

    let migratedKeysCount = 0;
    const keyChunks = chunkArray(keys, config.chunkSize);

    for (const keyChunk of keyChunks) {
      const promises = keyChunk.map(await processKey(sourceRedisClient, targetRedisClient, transformData));
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

async function processKey(
  sourceRedisClient: RedisClient,
  targetRedisClient: RedisClient,
  transformData: (oldKey: string, oldValue: RedisValue, oldKeyType: KeyType) => TransformedData
) {
  return async (oldKey: string) => {
    try {
      const oldKeyType: KeyType = (await sourceRedisClient.type(oldKey)) as KeyType;
      let oldValue: RedisValue;

      switch (oldKeyType) {
        case 'string':
          oldValue = await sourceRedisClient.get(oldKey);
          break;
        case 'hash':
          oldValue = await sourceRedisClient.hGetAll(oldKey);
          break;
        case 'list':
          oldValue = await sourceRedisClient.lRange(oldKey, 0, -1);
          break;
        case 'set':
          oldValue = await sourceRedisClient.sMembers(oldKey);
          break;
        case 'zset':
          oldValue = await sourceRedisClient.zRangeWithScores(oldKey, 0, -1);
          break;
        case 'ReJSON-RL':
          oldValue = await sourceRedisClient.json.get(oldKey);
          break;
        default:
          console.warn(`Key '${oldKey}', with key type '${oldKeyType}' not handled!`);
          return;
      }

      const ttl = await sourceRedisClient.ttl(oldKey);

      const { newKeyType, newKey, newValue } = transformData(oldKey, oldValue, oldKeyType);

      await targetRedisClient.del(newKey);

      switch (newKeyType) {
        case 'string':
          await targetRedisClient.set(newKey, newValue as RedisString);
          break;
        case 'hash':
          await targetRedisClient.hSet(newKey, newValue as RedisHash);
          break;
        case 'list':
          await targetRedisClient.lPush(newKey, newValue as RedisList);
          break;
        case 'set':
          await targetRedisClient.sAdd(newKey, Array.from(newValue as RedisSet));
          break;
        case 'zset':
          await targetRedisClient.zAdd(newKey, newValue as RedisSortedSet);
          break;
        case 'ReJSON-RL':
          await targetRedisClient.json.set(newKey, '$', newValue as RedisJson);
          break;
        default:
          console.warn(`Transformed key type '${newKeyType}' not handled!`);
      }

      if (ttl > -1) {
        await targetRedisClient.expire(newKey, ttl);
      }
    } catch (err) {
      console.error(`Error processing key '${oldKey}': ${(err as Error).message}`, (err as Error).stack);
    }
  };
}
