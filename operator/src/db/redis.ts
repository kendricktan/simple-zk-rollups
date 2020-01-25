import * as redis from "redis";

import { promisify } from "util";

import { getRedisCredentials } from "../utils/env";

const redisCredentials = getRedisCredentials();

export const redisClient = redis.createClient({
  host: redisCredentials.Host,
  port: redisCredentials.Port,
  password: redisCredentials.Password
});

// Async redis commands
export const redisGet = promisify(redisClient.get).bind(redisClient);
export const redisSet = promisify(redisClient.set).bind(redisClient);
export const redisOn = promisify(redisClient.on).bind(redisClient);
export const redisFlushAll = promisify(redisClient.flushall).bind(redisClient);

// Init redis
export const initRedis = async () => {
  // redisOn doesn't work for some reason
  // Try setting a value that expires after 10 seconds
  await redisSet("42", 42, "EX", 10);

  if (process.env.ENV_TYPE === "TEST") {
    await redisFlushAll("ASYNC");
    console.log("Flushing redis cache");
  }
};
