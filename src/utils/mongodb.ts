import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionAttempts = 0;
const maxRetries = 3;

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/material_generation';
    
    try {
      // For MongoDB 3.7.x driver compatibility with MongoDB 4.0
      client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        // retryWrites removed - not supported in older driver
      });
      
      await client.connect();
      console.log('MongoDB Client Connected (v3.7.x driver for MongoDB 4.0 compatibility)');
      
      // Reset connection attempts on successful connection
      connectionAttempts = 0;
      
      // Set up error handling (older driver style)
      client.on('error', (err: Error) => {
        console.error('MongoDB Client Error:', err);
        // Reset client on error
        client = null;
        db = null;
      });
      
      client.on('close', () => {
        console.log('MongoDB Client Disconnected');
        client = null;
        db = null;
      });
      
    } catch (error) {
      client = null;
      connectionAttempts++;
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          console.error('❌ MongoDB Authentication Error:', error.message);
          console.error('Please check your username, password, and authentication database.');
          console.error('For root user, make sure to use authSource=admin in the connection string.');
          throw new Error('MongoDB authentication failed. Please check credentials.');
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Server at')) {
          console.error('❌ MongoDB Connection Error:', error.message);
          console.error('Cannot connect to MongoDB server. Please check the connection details.');
          throw new Error('MongoDB connection failed. Please check server availability.');
        }
      }
      
      console.error('❌ MongoDB Connection Failed:', error);
      throw error;
    }
  }
  
  return client;
}

export async function getMongoDatabase(): Promise<Db> {
  if (!db) {
    const mongoClient = await getMongoClient();
    // For the 3.7.x driver, we get the database from the URI or specify default
    const dbName = process.env.MONGODB_URI?.split('/').pop()?.split('?')[0] || 'material_generation';
    db = mongoClient.db(dbName);
  }
  
  return db;
}

export async function getCollection(collectionName: string): Promise<Collection> {
  const database = await getMongoDatabase();
  return database.collection(collectionName);
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    try {
      await client.close();
      console.log('MongoDB Client Closed');
    } catch (error) {
      console.error('Error closing MongoDB client:', error);
    } finally {
      client = null;
      db = null;
    }
  }
}

// Test MongoDB connection
export async function testMongoConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const mongoClient = await getMongoClient();
    const db = await getMongoDatabase();
    // For older driver, use ping command
    await db.admin().ping();
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Helper function to ensure indexes are created (compatible with older driver)
export async function ensureIndexes(): Promise<void> {
  try {
    // Test connection first
    const testResult = await testMongoConnection();
    if (!testResult.success) {
      console.error('Cannot create indexes - MongoDB connection failed:', testResult.error);
      return;
    }
    
    const database = await getMongoDatabase();
    
    // Create indexes for better performance with proper error handling
    try {
      // Projects collection indexes
      await database.collection('projects').createIndex({ id: 1 }, { unique: true });
      console.log('✅ Created index for projects: id');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
        console.log('📋 Index already exists for projects: id');
      } else {
        console.error('❌ Failed to create index for projects:', error);
      }
    }

    try {
      // Sessions collection indexes
      await database.collection('sessions').createIndex({ id: 1 }, { unique: true });
      console.log('✅ Created index for sessions: id');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
        console.log('📋 Index already exists for sessions: id');
      } else {
        console.error('❌ Failed to create index for sessions:', error);
      }
    }

    try {
      await database.collection('sessions').createIndex({ projectId: 1 });
      console.log('✅ Created index for sessions: projectId');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
        console.log('📋 Index already exists for sessions: projectId');
      } else {
        console.error('❌ Failed to create index for sessions:', error);
      }
    }

    try {
      // Avatar sessions collection indexes
      await database.collection('avatar_sessions').createIndex({ id: 1 }, { unique: true });
      console.log('✅ Created index for avatar_sessions: id');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
        console.log('📋 Index already exists for avatar_sessions: id');
      } else {
        console.error('❌ Failed to create index for avatar_sessions:', error);
      }
    }

    try {
      await database.collection('avatar_sessions').createIndex({ productId: 1 });
      console.log('✅ Created index for avatar_sessions: productId');
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
        console.log('📋 Index already exists for avatar_sessions: productId');
      } else {
        console.error('❌ Failed to create index for avatar_sessions:', error);
      }
    }
    
    console.log('MongoDB indexes creation completed (v3.7.x driver)');
  } catch (error) {
    console.error('Error creating MongoDB indexes:', error);
    // Don't throw error - let the app continue without indexes
  }
} 