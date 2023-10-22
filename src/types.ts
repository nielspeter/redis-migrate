export interface Configuration {
  chunkSize: number;
  matchPattern?: string;
  sourceRedis: Redis;
  targetRedis: Redis;
}

export interface Redis {
  host: string;
  port: number;
  password?: string;
}
