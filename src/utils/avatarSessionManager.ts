import { getRedisClient } from './redis';
import { CombinedRatioResolutionOption, COMBINED_RATIO_RESOLUTION_OPTIONS } from '@/utils/imageRatioUtils';

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

// Extended interfaces for session data
export interface GeneratedAvatar {
  id: string;
  filename: string;
  url: string;
  prompt: string;
  taskId: string;
}

export interface ExistingImage {
  id: string;
  url: string;
  filename: string;
  selected: boolean;
}

export interface AvatarPrompt {
  id: number;
  content: string;
  runwayPrompt: string;
  chineseTranslation: string;
  isEdited: boolean;
  specification?: string;
  generatedImages: GeneratedAvatar[];
  isGeneratingImages: boolean;
  failedCount: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  editedContent?: string;
}

export interface GeneratedVideo {
  id: string;
  videoId: string;
  status: string;
  videoUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  assetId: string;
  voiceId: string;
  text: string;
  createdAt: string;
  videoData?: any; // Store full video data from HeyGen
}

export interface AvatarSessionMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  avatarCount: number;
  videoCount: number;
  hasAvatarGroup: boolean;
}

export interface AvatarSessionData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  
  // Core avatar data
  avatarGroup?: AvatarGroup;
  uploadedAssets: AvatarAsset[];
  motionAvatars?: string[]; // Array of motion avatar IDs
  
  // Generated content
  generatedVideos: GeneratedVideo[];
  generatedAvatars: GeneratedAvatar[];
  existingImages: ExistingImage[];
  selectedAvatars: any[]; // Selected avatars for video generation
  
  // AI interaction data
  avatarPrompts: AvatarPrompt[];
  conversation: ConversationMessage[];
  
  // Form state
  avatarDescription: string;
  videoText: string;
  activeTab: 'existing' | 'generate';
  aspectRatio: string;
  resolution: string;
  selectedCombinedOption: CombinedRatioResolutionOption;
  
  // Counts for metadata
  videoCount: number;
  avatarCount: number;
}

export class AvatarSessionManager {
  
  // Generate a unique avatar session ID
  static generateSessionId(): string {
    return `avatar_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new avatar session
  static async createSession(name: string = 'Untitled Avatar Session'): Promise<AvatarSessionData> {
    const redis = await getRedisClient();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: AvatarSessionData = {
      id: sessionId,
      name: name,
      createdAt: now,
      updatedAt: now,
      
      // Core avatar data
      uploadedAssets: [],
      motionAvatars: [],
      
      // Generated content
      generatedVideos: [],
      generatedAvatars: [],
      existingImages: [],
      selectedAvatars: [],
      
      // AI interaction data
      avatarPrompts: [],
      conversation: [],
      
      // Form state
      avatarDescription: '',
      videoText: '',
      activeTab: 'existing' as const,
      aspectRatio: '16:9',
      resolution: '1024x576',
      selectedCombinedOption: COMBINED_RATIO_RESOLUTION_OPTIONS.find(opt => opt.id === '16:9-1024x576') || COMBINED_RATIO_RESOLUTION_OPTIONS[0],
      
      // Counts for metadata
      videoCount: 0,
      avatarCount: 0,
    };

    // Store session data
    await redis.hSet(`${AVATAR_SESSION_PREFIX}${sessionId}`, 'data', JSON.stringify(sessionData));
    
    // Add to session list
    await redis.sAdd(AVATAR_SESSION_LIST_KEY, sessionId);
    
    console.log('✅ AvatarSessionManager: Created new session:', sessionId);
    return sessionData;
  }

  // Get all avatar sessions
  static async getAllSessions(): Promise<AvatarSessionMetadata[]> {
    const redis = await getRedisClient();
    
    try {
      console.log('🔍 AvatarSessionManager: Getting all sessions from Redis');
      const sessionIds = await redis.sMembers(AVATAR_SESSION_LIST_KEY);
      console.log('📋 AvatarSessionManager: Found session IDs:', sessionIds);
      
      const sessions: AvatarSessionMetadata[] = [];
      
      for (const sessionId of sessionIds) {
        try {
          const sessionDataStr = await redis.hGet(`${AVATAR_SESSION_PREFIX}${sessionId}`, 'data');
          if (sessionDataStr) {
            const sessionData: AvatarSessionData = JSON.parse(sessionDataStr);
            
            // Calculate counts based on actual data
            const avatarCount = (sessionData.uploadedAssets?.length || 0) + 
                               (sessionData.generatedAvatars?.length || 0) + 
                               (sessionData.existingImages?.length || 0);
            const videoCount = sessionData.generatedVideos?.length || 0;
            
            const metadata: AvatarSessionMetadata = {
              id: sessionData.id,
              name: sessionData.name || 'Untitled Avatar Session',
              createdAt: sessionData.createdAt,
              updatedAt: sessionData.updatedAt,
              avatarCount: avatarCount,
              videoCount: videoCount,
              hasAvatarGroup: !!sessionData.avatarGroup,
            };
            sessions.push(metadata);
          }
        } catch (error) {
          console.error(`❌ AvatarSessionManager: Error loading session ${sessionId}:`, error);
        }
      }
      
      // Sort by updatedAt descending
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      console.log('✅ AvatarSessionManager: Loaded sessions:', sessions.length);
      return sessions;
    } catch (error) {
      console.error('❌ AvatarSessionManager: Error loading all sessions:', error);
      return [];
    }
  }

  // Update session name
  static async updateSessionName(sessionId: string, name: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.name = name;
      await this.saveSession(session);
      console.log('✅ AvatarSessionManager: Updated session name:', { sessionId, name });
    } else {
      throw new Error(`Avatar session ${sessionId} not found`);
    }
  }

  // Increment video count
  static async incrementVideoCount(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.videoCount = (session.videoCount || 0) + 1;
      await this.saveSession(session);
      console.log('✅ AvatarSessionManager: Incremented video count:', { sessionId, videoCount: session.videoCount });
    } else {
      throw new Error(`Avatar session ${sessionId} not found`);
    }
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
      
      // Update timestamp and counts
      sessionData.updatedAt = new Date().toISOString();
      sessionData.avatarCount = (sessionData.uploadedAssets?.length || 0) + 
                               (sessionData.generatedAvatars?.length || 0) + 
                               (sessionData.existingImages?.length || 0);
      sessionData.videoCount = sessionData.generatedVideos?.length || 0;

      // Save updated data
      await redis.hSet(`${AVATAR_SESSION_PREFIX}${sessionData.id}`, 'data', JSON.stringify(sessionData));
      
      // Ensure session is in the list
      await redis.sAdd(AVATAR_SESSION_LIST_KEY, sessionData.id);
      
      console.log('✅ AvatarSessionManager: Session saved successfully:', {
        id: sessionData.id,
        avatarCount: sessionData.avatarCount,
        videoCount: sessionData.videoCount,
        hasAvatarGroup: !!sessionData.avatarGroup
      });
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error saving session ${sessionData.id}:`, error);
      throw error;
    }
  }

  // Save complete session state including all UI data
  static async saveCompleteSessionState(sessionData: AvatarSessionData): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      console.log('💾 AvatarSessionManager: Saving complete session state:', sessionData.id);
      
      // Update timestamp and counts
      sessionData.updatedAt = new Date().toISOString();
      sessionData.avatarCount = (sessionData.uploadedAssets?.length || 0) + 
                               (sessionData.generatedAvatars?.length || 0) + 
                               (sessionData.existingImages?.length || 0);
      sessionData.videoCount = sessionData.generatedVideos?.length || 0;

      // Save updated data
      await redis.hSet(`${AVATAR_SESSION_PREFIX}${sessionData.id}`, 'data', JSON.stringify(sessionData));
      
      // Ensure session is in the list
      await redis.sAdd(AVATAR_SESSION_LIST_KEY, sessionData.id);
      
      console.log('✅ AvatarSessionManager: Complete session state saved:', {
        id: sessionData.id,
        avatarCount: sessionData.avatarCount,
        videoCount: sessionData.videoCount,
        hasAvatarGroup: !!sessionData.avatarGroup,
        hasPrompts: sessionData.avatarPrompts?.length > 0,
        hasConversation: sessionData.conversation?.length > 0,
        hasFormData: !!sessionData.avatarDescription || !!sessionData.videoText
      });
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error saving complete session state ${sessionData.id}:`, error);
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