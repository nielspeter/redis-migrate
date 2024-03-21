import { Configuration } from '../src/types.js';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { RedisClient } from '../src/redis.js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { convert } from '../src/convert.js';
import { createClient } from 'redis';

let sourceContainer: StartedTestContainer;
let targetContainer: StartedTestContainer;
let sourceClient: RedisClient;
let targetClient: RedisClient;
let config: Configuration;

beforeAll(async () => {
  sourceContainer = await new GenericContainer('redis/redis-stack-server').withExposedPorts(6379).start();
  targetContainer = await new GenericContainer('redis/redis-stack-server').withExposedPorts(6379).start();

  sourceClient = createClient({
    socket: {
      host: sourceContainer.getHost(),
      port: sourceContainer.getMappedPort(6379),
    },
  });

  targetClient = createClient({
    socket: {
      host: targetContainer.getHost(),
      port: targetContainer.getMappedPort(6379),
    },
  });

  await sourceClient.connect();
  await targetClient.connect();

  config = {
    chunkSize: 25000,
    matchPattern: '',
    sourceRedis: {
      host: sourceContainer.getHost(),
      port: sourceContainer.getMappedPort(6379),
      password: '',
    },
    targetRedis: {
      host: targetContainer.getHost(),
      port: targetContainer.getMappedPort(6379),
      password: '',
    },
  };
});

afterAll(async () => {
  await sourceClient.quit();
  await targetClient.quit();
  await sourceContainer.stop();
  await targetContainer.stop();
});

describe('Convert', () => {
  test('Ttl', async () => {
    await sourceClient.set('key', 'bar');
    await sourceClient.expire('key', 10);
    await convert(config);
    expect(await targetClient.get('key')).toStrictEqual('bar');
    expect(await targetClient.ttl('key')).toStrictEqual(10);
  });

  test('String', async () => {
    await sourceClient.set('key', 'bar');
    await convert(config);
    expect(await targetClient.get('key')).toStrictEqual('bar');
  });

  test('Hash', async () => {
    await sourceClient.hSet('hashKey', 'field', 'value');
    await convert(config);
    expect(await targetClient.hGet('hashKey', 'field')).toBe('value');
  });

  test('List', async () => {
    await sourceClient.lPush('listKey', ['value']);
    await convert(config);
    expect(await targetClient.lRange('listKey', 0, -1)).toEqual(['value']);
  });

  test('Set', async () => {
    await sourceClient.sAdd('setKey', ['c', 'b', 'a', 'a']);
    await convert(config);
    expect(await targetClient.sMembers('setKey')).toEqual(['c', 'b', 'a']);
  });

  test('ZSet', async () => {
    await sourceClient.zAdd('zsetKey', [
      {
        score: 100,
        value: 'One Hundred',
      },
      {
        score: 99,
        value: 'Ninety Nine',
      },
    ]);
    await convert(config);
    expect(await targetClient.zRange('zsetKey', 0, -1)).toEqual(['Ninety Nine', 'One Hundred']);
  });

  test('Json', async () => {
    await sourceClient.json.set('jsonKey', '$', { foo: 'bar' });
    await convert(config);
    expect(await targetClient.json.get('jsonKey')).toStrictEqual({ foo: 'bar' });
  });

  test('Bitmap', async () => {
    await sourceClient.setBit('bitmapKey', 7, 1);
    await convert(config);
    expect(await targetClient.getBit('bitmapKey', 7)).toBe(1);
  });
});
