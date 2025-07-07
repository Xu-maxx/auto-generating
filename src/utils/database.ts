import { getRedisClient } from './redis';
import { getCollection, ensureIndexes, testMongoConnection, getMongoClient, getMongoDatabase, closeMongoClient } from './mongodb';

export type StorageType = 'redis' | 'mongodb';

let storageHealthy = true;
let lastHealthCheck = 0;
const healthCheckInterval = 30000; // 30 seconds

export function getStorageType(): StorageType {
  return (process.env.STORAGE_TYPE as StorageType) || 'redis';
}

// Check if current storage is healthy
async function checkStorageHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Only check health every 30 seconds to avoid excessive checks
  if (now - lastHealthCheck < healthCheckInterval && storageHealthy) {
    return storageHealthy;
  }
  
  lastHealthCheck = now;
  const storageType = getStorageType();
  
  try {
    if (storageType === 'mongodb') {
      const result = await testMongoConnection();
      storageHealthy = result.success;
      if (!storageHealthy) {
        console.warn('⚠️ MongoDB health check failed:', result.error);
      }
    } else {
      const redis = await getRedisClient();
      await redis.ping();
      storageHealthy = true;
    }
  } catch (error) {
    console.error(`❌ Storage health check failed (${storageType}):`, error);
    storageHealthy = false;
  }
  
  return storageHealthy;
}

interface DatabaseAdapter {
  // Key-Value operations
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  
  // Set operations
  sadd(key: string, value: any): Promise<void>;
  srem(key: string, value: any): Promise<void>;
  smembers(key: string): Promise<any[]>;
  scard(key: string): Promise<number>;
  sismember(key: string, value: any): Promise<boolean>;
  
  // Hash operations
  hset(key: string, field: string, value: any): Promise<void>;
  hget(key: string, field: string): Promise<any | null>;
  hgetall(key: string): Promise<{ [key: string]: any }>;
  hdel(key: string, field: string): Promise<void>;
  hexists(key: string, field: string): Promise<boolean>;
  
  // Expiration
  expire(key: string, ttl: number): Promise<void>;
  
  // Connection management
  quit(): Promise<void>;
  
  // Document operations for legacy compatibility
  setDocument(collection: string, id: string, data: any): Promise<void>;
  getDocument(collection: string, id: string): Promise<any | null>;
  deleteDocument(collection: string, id: string): Promise<void>;
  addToSet(collection: string, setName: string, value: string): Promise<void>;
  removeFromSet(collection: string, setName: string, value: string): Promise<void>;
  getSetMembers(collection: string, setName: string): Promise<string[]>;
  getSetSize(collection: string, setName: string): Promise<number>;
  getAllDocuments(collection: string): Promise<any[]>;
  getDocuments(collection: string, query: any): Promise<any[]>;
  updateDocument(collection: string, id: string, data: any): Promise<void>;
}

// Redis adapter
class RedisAdapter implements DatabaseAdapter {
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const redis = await getRedisClient();
    await redis.hSet(`${key}:data`, 'data', JSON.stringify(value));
    if (ttl) {
      await redis.expire(`${key}:data`, ttl);
    }
  }
  
  async get(key: string): Promise<any | null> {
    const redis = await getRedisClient();
    const dataStr = await redis.hGet(`${key}:data`, 'data');
    return dataStr ? JSON.parse(dataStr) : null;
  }
  
  async del(key: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.del(`${key}:data`);
  }
  
  async exists(key: string): Promise<boolean> {
    const redis = await getRedisClient();
    const dataStr = await redis.hGet(`${key}:data`, 'data');
    return !!dataStr;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const redis = await getRedisClient();
    const keys = await redis.keys(`${pattern ? pattern.replace(/\*/g, '.*') : '*'}`);
    return keys.map(key => key.split(':')[0]);
  }
  
  async sadd(key: string, value: any): Promise<void> {
    const redis = await getRedisClient();
    await redis.sAdd(`${key}:set`, value);
  }
  
  async srem(key: string, value: any): Promise<void> {
    const redis = await getRedisClient();
    await redis.sRem(`${key}:set`, value);
  }
  
  async smembers(key: string): Promise<any[]> {
    const redis = await getRedisClient();
    return await redis.sMembers(`${key}:set`);
  }
  
  async scard(key: string): Promise<number> {
    const redis = await getRedisClient();
    return await redis.sCard(`${key}:set`);
  }
  
  async sismember(key: string, value: any): Promise<boolean> {
    const redis = await getRedisClient();
    return await redis.sIsMember(`${key}:set`, value);
  }
  
  async hset(key: string, field: string, value: any): Promise<void> {
    const redis = await getRedisClient();
    await redis.hSet(`${key}:fields`, field, JSON.stringify(value));
  }
  
  async hget(key: string, field: string): Promise<any | null> {
    const redis = await getRedisClient();
    const dataStr = await redis.hGet(`${key}:fields`, field);
    return dataStr ? JSON.parse(dataStr) : null;
  }
  
  async hgetall(key: string): Promise<{ [key: string]: any }> {
    const redis = await getRedisClient();
    const fields = await redis.hGetAll(`${key}:fields`);
    const result: { [key: string]: any } = {};
    for (const field in fields) {
      result[field] = JSON.parse(fields[field]);
    }
    return result;
  }
  
  async hdel(key: string, field: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.hDel(`${key}:fields`, field);
  }
  
  async hexists(key: string, field: string): Promise<boolean> {
    const redis = await getRedisClient();
    const dataStr = await redis.hGet(`${key}:fields`, field);
    return !!dataStr;
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    const redis = await getRedisClient();
    await redis.expire(`${key}:data`, ttl);
  }
  
  async quit(): Promise<void> {
    // Redis connection is managed by the client library
  }
  
  async setDocument(collection: string, id: string, data: any): Promise<void> {
    await this.set(id, data);
  }
  
  async getDocument(collection: string, id: string): Promise<any | null> {
    return this.get(id);
  }
  
  async deleteDocument(collection: string, id: string): Promise<void> {
    await this.del(id);
  }
  
  async addToSet(collection: string, setName: string, value: string): Promise<void> {
    await this.sadd(collection, value);
  }
  
  async removeFromSet(collection: string, setName: string, value: string): Promise<void> {
    await this.srem(collection, value);
  }
  
  async getSetMembers(collection: string, setName: string): Promise<string[]> {
    return this.smembers(collection);
  }
  
  async getSetSize(collection: string, setName: string): Promise<number> {
    return this.scard(collection);
  }
  
  async getAllDocuments(collection: string): Promise<any[]> {
    const keys = await this.keys(`${collection}:*`);
    const documents = [];
    
    for (const key of keys) {
      if (key.includes(':data') || key.includes(':list') || key.includes(':sessions:')) continue;
      const data = await this.get(key);
      if (data) {
        documents.push(data);
      }
    }
    
    return documents;
  }
  
  async getDocuments(collection: string, query: any): Promise<any[]> {
    const allDocs = await this.getAllDocuments(collection);
    return allDocs.filter(doc => {
      return Object.keys(query).every(key => doc[key] === query[key]);
    });
  }
  
  async updateDocument(collection: string, id: string, data: any): Promise<void> {
    await this.set(id, data);
  }
}

// MongoDB adapter with better error handling
class MongoDBAdapter implements DatabaseAdapter {
  private isConnected = false;
  
  constructor() {
    // Initialize connection when adapter is created
    this.testConnection();
  }
  
  private async testConnection(): Promise<void> {
    try {
      const client = await getMongoClient();
      const db = await getMongoDatabase();
      // For older driver, use ping command
      await db.admin().ping();
      this.isConnected = true;
      console.log('✅ MongoDB Adapter Connected (v3.7.x driver for MongoDB 4.0)');
    } catch (error) {
      this.isConnected = false;
      console.error('❌ MongoDB Adapter Connection Failed:', error);
      throw error;
    }
  }
  
  async isAvailable(): Promise<boolean> {
    if (!this.isConnected) {
      try {
        await this.testConnection();
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MongoDB not available');
    }
    
    const collection = await getCollection('key_value_store');
    const document = {
      _id: key,
      value,
      createdAt: new Date(),
      ...(ttl && { expiresAt: new Date(Date.now() + ttl * 1000) })
    };
    
    // For older driver, use replaceOne with upsert
    await collection.replaceOne(
      { _id: key },
      document,
      { upsert: true }
    );
  }
  
  async get(key: string): Promise<any | null> {
    if (!await this.isAvailable()) {
      return null;
    }
    
    const collection = await getCollection('key_value_store');
    const document = await collection.findOne({ _id: key });
    
    if (!document) {
      return null;
    }
    
    // Check if document has expired
    if (document.expiresAt && document.expiresAt < new Date()) {
      await this.del(key);
      return null;
    }
    
    return document.value;
  }
  
  async del(key: string): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const collection = await getCollection('key_value_store');
    await collection.deleteOne({ _id: key });
  }
  
  async exists(key: string): Promise<boolean> {
    if (!await this.isAvailable()) {
      return false;
    }
    
    const collection = await getCollection('key_value_store');
    const document = await collection.findOne({ _id: key });
    
    if (!document) {
      return false;
    }
    
    // Check if document has expired
    if (document.expiresAt && document.expiresAt < new Date()) {
      await this.del(key);
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    if (!await this.isAvailable()) {
      return [];
    }
    
    const collection = await getCollection('key_value_store');
    
    // For older driver, use simple find query
    const query = pattern ? { 
      _id: { $regex: pattern.replace(/\*/g, '.*') } 
    } : {};
    
    const documents = await collection.find(query).toArray();
    
    // Filter out expired documents
    const validKeys = [];
    for (const doc of documents) {
      if (!doc.expiresAt || doc.expiresAt >= new Date()) {
        validKeys.push(doc._id);
      } else {
        // Clean up expired document
        await this.del(doc._id);
      }
    }
    
    return validKeys;
  }
  
  async sadd(key: string, value: any): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MongoDB not available');
    }
    
    const collection = await getCollection('sets');
    // For older driver, use updateOne with upsert
    await collection.updateOne(
      { _id: key },
      { 
        $addToSet: { values: value },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }
  
  async srem(key: string, value: any): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const collection = await getCollection('sets');
    await collection.updateOne(
      { _id: key },
      { $pull: { values: value } }
    );
  }
  
  async smembers(key: string): Promise<any[]> {
    if (!await this.isAvailable()) {
      return [];
    }
    
    const collection = await getCollection('sets');
    const document = await collection.findOne({ _id: key });
    return document?.values || [];
  }
  
  async scard(key: string): Promise<number> {
    if (!await this.isAvailable()) {
      return 0;
    }
    
    const collection = await getCollection('sets');
    const document = await collection.findOne({ _id: key });
    return document?.values?.length || 0;
  }
  
  async sismember(key: string, value: any): Promise<boolean> {
    if (!await this.isAvailable()) {
      return false;
    }
    
    const collection = await getCollection('sets');
    const document = await collection.findOne({ 
      _id: key, 
      values: value 
    });
    return !!document;
  }
  
  async hset(key: string, field: string, value: any): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MongoDB not available');
    }
    
    const collection = await getCollection('hashes');
    // For older driver, use updateOne with upsert
    await collection.updateOne(
      { _id: key },
      { 
        $set: { [`fields.${field}`]: value },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }
  
  async hget(key: string, field: string): Promise<any | null> {
    if (!await this.isAvailable()) {
      return null;
    }
    
    const collection = await getCollection('hashes');
    const document = await collection.findOne({ _id: key });
    return document?.fields?.[field] || null;
  }
  
  async hgetall(key: string): Promise<{ [key: string]: any }> {
    if (!await this.isAvailable()) {
      return {};
    }
    
    const collection = await getCollection('hashes');
    const document = await collection.findOne({ _id: key });
    return document?.fields || {};
  }
  
  async hdel(key: string, field: string): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const collection = await getCollection('hashes');
    await collection.updateOne(
      { _id: key },
      { $unset: { [`fields.${field}`]: "" } }
    );
  }
  
  async hexists(key: string, field: string): Promise<boolean> {
    if (!await this.isAvailable()) {
      return false;
    }
    
    const collection = await getCollection('hashes');
    const document = await collection.findOne({ 
      _id: key,
      [`fields.${field}`]: { $exists: true }
    });
    return !!document;
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    // Update in key_value_store
    const kvCollection = await getCollection('key_value_store');
    await kvCollection.updateOne(
      { _id: key },
      { $set: { expiresAt } }
    );
    
    // Update in sets collection
    const setsCollection = await getCollection('sets');
    await setsCollection.updateOne(
      { _id: key },
      { $set: { expiresAt } }
    );
    
    // Update in hashes collection
    const hashesCollection = await getCollection('hashes');
    await hashesCollection.updateOne(
      { _id: key },
      { $set: { expiresAt } }
    );
  }
  
  async quit(): Promise<void> {
    await closeMongoClient();
    this.isConnected = false;
  }
  
  // Document operations for legacy compatibility
  async setDocument(collection: string, id: string, data: any): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MongoDB not available');
    }
    
    const coll = await getCollection(collection);
    await coll.replaceOne({ id }, { id, ...data }, { upsert: true });
  }
  
  async getDocument(collection: string, id: string): Promise<any | null> {
    if (!await this.isAvailable()) {
      return null;
    }
    
    const coll = await getCollection(collection);
    const doc = await coll.findOne({ id });
    if (doc) {
      // Remove MongoDB's _id field
      const { _id, ...result } = doc;
      return result;
    }
    return null;
  }
  
  async deleteDocument(collection: string, id: string): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const coll = await getCollection(collection);
    await coll.deleteOne({ id });
  }
  
  async addToSet(collection: string, setName: string, value: string): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MongoDB not available');
    }
    
    const coll = await getCollection(`${collection}_sets`);
    await coll.updateOne(
      { setName },
      { $addToSet: { values: value } },
      { upsert: true }
    );
  }
  
  async removeFromSet(collection: string, setName: string, value: string): Promise<void> {
    if (!await this.isAvailable()) {
      return;
    }
    
    const coll = await getCollection(`${collection}_sets`);
    await coll.updateOne(
      { setName },
      { $pull: { values: value } }
    );
  }
  
  async getSetMembers(collection: string, setName: string): Promise<string[]> {
    if (!await this.isAvailable()) {
      return [];
    }
    
    const coll = await getCollection(`${collection}_sets`);
    const doc = await coll.findOne({ setName });
    return doc?.values || [];
  }
  
  async getSetSize(collection: string, setName: string): Promise<number> {
    const members = await this.getSetMembers(collection, setName);
    return members.length;
  }
  
  async getAllDocuments(collection: string): Promise<any[]> {
    if (!await this.isAvailable()) {
      return [];
    }
    
    const coll = await getCollection(collection);
    const docs = await coll.find({}).toArray();
    return docs.map(doc => {
      const { _id, ...result } = doc;
      return result;
    });
  }
  
  async getDocuments(collection: string, query: any): Promise<any[]> {
    if (!await this.isAvailable()) {
      return [];
    }
    
    const coll = await getCollection(collection);
    const docs = await coll.find(query).toArray();
    return docs.map(doc => {
      const { _id, ...result } = doc;
      return result;
    });
  }
  
  async updateDocument(collection: string, id: string, data: any): Promise<void> {
    await this.setDocument(collection, id, data);
  }
}

// Adaptive adapter that can fall back to Redis if MongoDB fails
class AdaptiveDatabaseAdapter implements DatabaseAdapter {
  private mongoAdapter: MongoDBAdapter;
  private redisAdapter: RedisAdapter;
  private fallbackActive = false;
  
  constructor() {
    this.mongoAdapter = new MongoDBAdapter();
    this.redisAdapter = new RedisAdapter();
  }
  
  private async executeWithFallback<T>(operation: () => Promise<T>): Promise<T> {
    const storageType = getStorageType();
    
    // If configured for Redis, use Redis directly
    if (storageType === 'redis') {
      return operation();
    }
    
    // Try MongoDB first
    try {
      const result = await operation();
      // Reset fallback if operation succeeds
      if (this.fallbackActive) {
        this.fallbackActive = false;
        console.log('✅ MongoDB connection restored, switching back from Redis fallback');
      }
      return result;
    } catch (error) {
      if (!this.fallbackActive) {
        console.warn('⚠️ MongoDB operation failed, falling back to Redis:', error instanceof Error ? error.message : error);
        this.fallbackActive = true;
      }
      
      // Fall back to Redis adapter
      throw error; // For now, we'll throw to let the caller handle it
    }
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.set(key, value, ttl);
    } else {
      return this.redisAdapter.set(key, value, ttl);
    }
  }
  
  async get(key: string): Promise<any | null> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.get(key);
    } else {
      return this.redisAdapter.get(key);
    }
  }
  
  async del(key: string): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.del(key);
    } else {
      return this.redisAdapter.del(key);
    }
  }
  
  async exists(key: string): Promise<boolean> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.exists(key);
    } else {
      return this.redisAdapter.exists(key);
    }
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.keys(pattern);
    } else {
      return this.redisAdapter.keys(pattern);
    }
  }
  
  async sadd(key: string, value: any): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.sadd(key, value);
    } else {
      return this.redisAdapter.sadd(key, value);
    }
  }
  
  async srem(key: string, value: any): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.srem(key, value);
    } else {
      return this.redisAdapter.srem(key, value);
    }
  }
  
  async smembers(key: string): Promise<any[]> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.smembers(key);
    } else {
      return this.redisAdapter.smembers(key);
    }
  }
  
  async scard(key: string): Promise<number> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.scard(key);
    } else {
      return this.redisAdapter.scard(key);
    }
  }
  
  async sismember(key: string, value: any): Promise<boolean> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.sismember(key, value);
    } else {
      return this.redisAdapter.sismember(key, value);
    }
  }
  
  async hset(key: string, field: string, value: any): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.hset(key, field, value);
    } else {
      return this.redisAdapter.hset(key, field, value);
    }
  }
  
  async hget(key: string, field: string): Promise<any | null> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.hget(key, field);
    } else {
      return this.redisAdapter.hget(key, field);
    }
  }
  
  async hgetall(key: string): Promise<{ [key: string]: any }> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.hgetall(key);
    } else {
      return this.redisAdapter.hgetall(key);
    }
  }
  
  async hdel(key: string, field: string): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.hdel(key, field);
    } else {
      return this.redisAdapter.hdel(key, field);
    }
  }
  
  async hexists(key: string, field: string): Promise<boolean> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.hexists(key, field);
    } else {
      return this.redisAdapter.hexists(key, field);
    }
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.expire(key, ttl);
    } else {
      return this.redisAdapter.expire(key, ttl);
    }
  }
  
  async quit(): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.quit();
    } else {
      return this.redisAdapter.quit();
    }
  }
  
  async setDocument(collection: string, id: string, data: any): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.setDocument(collection, id, data);
    } else {
      return this.redisAdapter.setDocument(collection, id, data);
    }
  }
  
  async getDocument(collection: string, id: string): Promise<any | null> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.getDocument(collection, id);
    } else {
      return this.redisAdapter.getDocument(collection, id);
    }
  }
  
  async deleteDocument(collection: string, id: string): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.deleteDocument(collection, id);
    } else {
      return this.redisAdapter.deleteDocument(collection, id);
    }
  }
  
  async addToSet(collection: string, setName: string, value: string): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.addToSet(collection, setName, value);
    } else {
      return this.redisAdapter.addToSet(collection, setName, value);
    }
  }
  
  async removeFromSet(collection: string, setName: string, value: string): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.removeFromSet(collection, setName, value);
    } else {
      return this.redisAdapter.removeFromSet(collection, setName, value);
    }
  }
  
  async getSetMembers(collection: string, setName: string): Promise<string[]> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.getSetMembers(collection, setName);
    } else {
      return this.redisAdapter.getSetMembers(collection, setName);
    }
  }
  
  async getSetSize(collection: string, setName: string): Promise<number> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.getSetSize(collection, setName);
    } else {
      return this.redisAdapter.getSetSize(collection, setName);
    }
  }
  
  async getAllDocuments(collection: string): Promise<any[]> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.getAllDocuments(collection);
    } else {
      return this.redisAdapter.getAllDocuments(collection);
    }
  }
  
  async getDocuments(collection: string, query: any): Promise<any[]> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.getDocuments(collection, query);
    } else {
      return this.redisAdapter.getDocuments(collection, query);
    }
  }
  
  async updateDocument(collection: string, id: string, data: any): Promise<void> {
    const storageType = getStorageType();
    if (storageType === 'mongodb') {
      return this.mongoAdapter.updateDocument(collection, id, data);
    } else {
      return this.redisAdapter.updateDocument(collection, id, data);
    }
  }
}

// Factory function to get the appropriate database adapter
export function getDatabaseAdapter(): DatabaseAdapter {
  return new AdaptiveDatabaseAdapter();
}

// Helper function to initialize the database
export async function initializeDatabase(): Promise<void> {
  const storageType = getStorageType();
  console.log(`Initializing database with storage type: ${storageType}`);
  
  if (storageType === 'mongodb') {
    try {
      await ensureIndexes();
      console.log('✅ MongoDB initialized successfully');
    } catch (error) {
      console.error('❌ MongoDB initialization failed:', error);
      console.warn('⚠️ Application will continue, but performance may be affected');
    }
  } else {
    console.log('✅ Redis storage configured');
  }
} 