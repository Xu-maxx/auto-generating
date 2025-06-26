import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
      },
    });

    client.on('error', (err: Error) => console.error('Redis Client Error', err));
    client.on('connect', () => console.log('Redis Client Connected'));
    client.on('disconnect', () => console.log('Redis Client Disconnected'));
    
    await client.connect();
  }
  
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
  }
} 