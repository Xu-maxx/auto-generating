import { getStorageType, initializeDatabase } from './database';

// Initialize database on app startup
export async function initializeDatabaseOnStartup(): Promise<void> {
  try {
    console.log('🚀 Initializing database connection...');
    
    const storageType = getStorageType();
    console.log(`📊 Using storage type: ${storageType}`);
    
    await initializeDatabase();
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    // Don't throw error to prevent app from crashing
    // The app should still work, but may have performance issues
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; storage: string; error?: string }> {
  try {
    const storageType = getStorageType();
    
    if (storageType === 'mongodb') {
      const { getMongoDatabase } = await import('./mongodb');
      const db = await getMongoDatabase();
      await db.admin().ping();
      return { healthy: true, storage: storageType };
    } else {
      const { getRedisClient } = await import('./redis');
      const redis = await getRedisClient();
      await redis.ping();
      return { healthy: true, storage: storageType };
    }
  } catch (error) {
    return { 
      healthy: false, 
      storage: getStorageType(), 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Migration helper for switching from Redis to MongoDB
export async function migrateFromRedisToMongoDB(): Promise<void> {
  try {
    console.log('🔄 Starting migration from Redis to MongoDB...');
    
    const { getRedisClient } = await import('./redis');
    const { getCollection } = await import('./mongodb');
    
    const redis = await getRedisClient();
    
    // Migrate projects
    console.log('📦 Migrating projects...');
    const projectKeys = await redis.keys('project:*');
    const projectCollection = await getCollection('projects');
    
    for (const key of projectKeys) {
      if (key.includes(':data') || key.includes(':list') || key.includes(':sessions:')) continue;
      
      const projectDataStr = await redis.hGet(key, 'data');
      if (projectDataStr) {
        const projectData = JSON.parse(projectDataStr);
        await projectCollection.replaceOne(
          { id: projectData.id },
          projectData,
          { upsert: true }
        );
        console.log(`✅ Migrated project: ${projectData.id}`);
      }
    }
    
    // Migrate sessions
    console.log('📝 Migrating sessions...');
    const sessionKeys = await redis.keys('session:*');
    const sessionCollection = await getCollection('sessions');
    
    for (const key of sessionKeys) {
      if (key.includes(':data') || key.includes(':list')) continue;
      
      const sessionDataStr = await redis.hGet(key, 'data');
      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        await sessionCollection.replaceOne(
          { id: sessionData.id },
          sessionData,
          { upsert: true }
        );
        console.log(`✅ Migrated session: ${sessionData.id}`);
      }
    }
    
    // Migrate avatar sessions
    console.log('🖼️ Migrating avatar sessions...');
    const avatarKeys = await redis.keys('avatar:session:*');
    const avatarCollection = await getCollection('avatar_sessions');
    
    for (const key of avatarKeys) {
      const avatarDataStr = await redis.hGet(key, 'data');
      if (avatarDataStr) {
        const avatarData = JSON.parse(avatarDataStr);
        await avatarCollection.replaceOne(
          { id: avatarData.id },
          avatarData,
          { upsert: true }
        );
        console.log(`✅ Migrated avatar session: ${avatarData.id}`);
      }
    }
    
    // Migrate sets (relationships)
    console.log('🔗 Migrating relationships...');
    const setsCollection = await getCollection('projects_sets');
    
    // Project lists
    const projectList = await redis.sMembers('projects:list');
    if (projectList.length > 0) {
      await setsCollection.replaceOne(
        { setName: 'list' },
        { setName: 'list', values: projectList },
        { upsert: true }
      );
    }
    
    // Session lists
    const sessionList = await redis.sMembers('sessions:list');
    if (sessionList.length > 0) {
      const sessionSetsCollection = await getCollection('sessions_sets');
      await sessionSetsCollection.replaceOne(
        { setName: 'list' },
        { setName: 'list', values: sessionList },
        { upsert: true }
      );
    }
    
    // Avatar session lists
    const avatarList = await redis.sMembers('avatar:sessions:list');
    if (avatarList.length > 0) {
      const avatarSetsCollection = await getCollection('avatar_sessions_sets');
      await avatarSetsCollection.replaceOne(
        { setName: 'list' },
        { setName: 'list', values: avatarList },
        { upsert: true }
      );
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('⚠️  Please update your STORAGE_TYPE environment variable to "mongodb" and restart the application');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Helper function to get storage statistics
export async function getStorageStats(): Promise<{
  storage: string;
  projects: number;
  sessions: number;
  avatarSessions: number;
}> {
  const storageType = getStorageType();
  
  if (storageType === 'mongodb') {
    const { getCollection } = await import('./mongodb');
    
    const projectsCollection = await getCollection('projects');
    const sessionsCollection = await getCollection('sessions');
    const avatarSessionsCollection = await getCollection('avatar_sessions');
    
    const [projects, sessions, avatarSessions] = await Promise.all([
      projectsCollection.countDocuments(),
      sessionsCollection.countDocuments(),
      avatarSessionsCollection.countDocuments()
    ]);
    
    return { storage: storageType, projects, sessions, avatarSessions };
  } else {
    const { getRedisClient } = await import('./redis');
    const redis = await getRedisClient();
    
    const [projectKeys, sessionKeys, avatarKeys] = await Promise.all([
      redis.keys('project:*'),
      redis.keys('session:*'),
      redis.keys('avatar:session:*')
    ]);
    
    return {
      storage: storageType,
      projects: projectKeys.filter(key => !key.includes(':data') && !key.includes(':list') && !key.includes(':sessions:')).length,
      sessions: sessionKeys.filter(key => !key.includes(':data') && !key.includes(':list')).length,
      avatarSessions: avatarKeys.length
    };
  }
} 