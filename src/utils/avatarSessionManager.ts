import { getRedisClient } from './redis';

const AVATAR_SESSION_PREFIX = 'avatar:session:';
const AVATAR_SESSION_LIST_KEY = 'avatar:sessions:list';

export interface AvatarAsset {
  id: string;
  imageKey: string;
  filename: string;
  url: string;
  contentType: string;
  uploadedAt: string;
  motionAvatarId?: string; // ID of motion-enabled version
  hasMotion?: boolean; // Whether motion has been added
  motionAddedAt?: string; // When motion was added
}

export interface AvatarGroup {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  motionEnabled?: boolean; // Whether group has motion-enabled avatars
}

export interface AvatarSessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  avatarGroup?: AvatarGroup;
  uploadedAssets: AvatarAsset[];
  motionAvatars?: string[]; // Array of motion avatar IDs
}

export class AvatarSessionManager {
  
  // Generate a unique avatar session ID
  static generateSessionId(): string {
    return `avatar_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new avatar session
  static async createSession(): Promise<AvatarSessionData> {
    const redis = await getRedisClient();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: AvatarSessionData = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      uploadedAssets: [],
    };

    // Store session data
    await redis.hSet(`${AVATAR_SESSION_PREFIX}${sessionId}`, 'data', JSON.stringify(sessionData));
    
    // Add to session list
    await redis.sAdd(AVATAR_SESSION_LIST_KEY, sessionId);
    
    console.log('✅ AvatarSessionManager: Created new session:', sessionId);
    return sessionData;
  }

  // Get session by ID
  static async getSession(sessionId: string): Promise<AvatarSessionData | null> {
    const redis = await getRedisClient();
    
    try {
      console.log('🔍 AvatarSessionManager: Getting session from Redis:', sessionId);
      const sessionDataStr = await redis.hGet(`${AVATAR_SESSION_PREFIX}${sessionId}`, 'data');
      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        console.log('✅ AvatarSessionManager: Session found:', {
          id: sessionData.id,
          hasAvatarGroup: !!sessionData.avatarGroup,
          assetsCount: sessionData.uploadedAssets?.length || 0
        });
        return sessionData;
      } else {
        console.log('❌ AvatarSessionManager: Session not found:', sessionId);
      }
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error loading session ${sessionId}:`, error);
    }
    
    return null;
  }

  // Save/update session
  static async saveSession(sessionData: AvatarSessionData): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      console.log('💾 AvatarSessionManager: Saving session to Redis:', sessionData.id);
      
      // Update timestamp
      sessionData.updatedAt = new Date().toISOString();

      // Save updated data
      await redis.hSet(`${AVATAR_SESSION_PREFIX}${sessionData.id}`, 'data', JSON.stringify(sessionData));
      
      // Ensure session is in the list
      await redis.sAdd(AVATAR_SESSION_LIST_KEY, sessionData.id);
      
      console.log('✅ AvatarSessionManager: Session saved successfully:', {
        id: sessionData.id,
        hasAvatarGroup: !!sessionData.avatarGroup,
        assetsCount: sessionData.uploadedAssets?.length || 0
      });
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error saving session ${sessionData.id}:`, error);
      throw error;
    }
  }

  // Add uploaded asset to session
  static async addAssetToSession(sessionId: string, asset: AvatarAsset): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.uploadedAssets.push(asset);
      await this.saveSession(session);
    } else {
      throw new Error(`Avatar session ${sessionId} not found`);
    }
  }

  // Set avatar group for session
  static async setAvatarGroup(sessionId: string, avatarGroup: AvatarGroup): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.avatarGroup = avatarGroup;
      await this.saveSession(session);
    } else {
      throw new Error(`Avatar session ${sessionId} not found`);
    }
  }

  // Add motion avatar to session
  static async addMotionToAsset(sessionId: string, assetId: string, motionAvatarId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      // Update the asset with motion information
      const assetIndex = session.uploadedAssets.findIndex(asset => asset.id === assetId);
      if (assetIndex !== -1) {
        session.uploadedAssets[assetIndex] = {
          ...session.uploadedAssets[assetIndex],
          motionAvatarId,
          hasMotion: true,
          motionAddedAt: new Date().toISOString()
        };
      }

      // Add to motion avatars array
      if (!session.motionAvatars) {
        session.motionAvatars = [];
      }
      if (!session.motionAvatars.includes(motionAvatarId)) {
        session.motionAvatars.push(motionAvatarId);
      }

      // Mark avatar group as motion-enabled
      if (session.avatarGroup) {
        session.avatarGroup.motionEnabled = true;
      }

      await this.saveSession(session);
      console.log('✅ AvatarSessionManager: Added motion to asset:', { assetId, motionAvatarId });
    } else {
      throw new Error(`Avatar session ${sessionId} not found`);
    }
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      await redis.del(`${AVATAR_SESSION_PREFIX}${sessionId}`);
      await redis.sRem(AVATAR_SESSION_LIST_KEY, sessionId);
      console.log('✅ AvatarSessionManager: Session deleted:', sessionId);
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Clean up old sessions (older than 24 hours)
  static async cleanupOldSessions(): Promise<void> {
    const redis = await getRedisClient();
    const sessionIds = await redis.sMembers(AVATAR_SESSION_LIST_KEY);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    for (const sessionId of sessionIds) {
      try {
        const session = await this.getSession(sessionId);
        if (session && session.createdAt < oneDayAgo) {
          await this.deleteSession(sessionId);
          console.log('🧹 AvatarSessionManager: Cleaned up old session:', sessionId);
        }
      } catch (error) {
        console.error(`Error cleaning up session ${sessionId}:`, error);
      }
    }
  }
} 