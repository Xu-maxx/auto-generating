import { getDatabaseAdapter } from './database';
import { CombinedRatioResolutionOption, COMBINED_RATIO_RESOLUTION_OPTIONS } from '@/utils/imageRatioUtils';

const AVATAR_SESSION_PREFIX = 'avatar:session:';
const AVATAR_SESSION_LIST_KEY = 'avatar:sessions:list';
const PRODUCT_AVATAR_SESSION_PREFIX = 'avatar:product:sessions:'; // New: product-specific sessions

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
  originalAvatarImageUrl?: string; // Store original avatar image URL for keyframe extraction
}

export interface AvatarSessionMetadata {
  id: string;
  name: string;
  productId?: string; // New: product ID for session association
  createdAt: string;
  updatedAt: string;
  avatarCount: number;
  videoCount: number;
  hasAvatarGroup: boolean;
  isProcessing?: boolean;
  processingStatus?: string | null;
  errorCount?: number;
}

export interface AvatarSessionData {
  id: string;
  name: string;
  productId?: string; // New: product ID for session association
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
  
  // Processing states (NEW: to preserve ongoing operations)
  isGeneratingVideo?: boolean;
  videoGenerationStatus?: string;
  isAddingMotion?: boolean;
  motionStatus?: string;
  isUploading?: boolean;
  uploadStatus?: string;
  lastProcessingUpdate?: string; // Timestamp of last processing update
  
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
  static async createSession(name?: string, productId?: string): Promise<AvatarSessionData> {
    const db = getDatabaseAdapter();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: AvatarSessionData = {
      id: sessionId,
      productId: productId || '',
      name: name || 'Untitled Avatar Session',
      createdAt: now,
      updatedAt: now,
      
      // Core avatar data
      avatarGroup: undefined,
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
      activeTab: 'existing',
      aspectRatio: '16:9',
      resolution: '1024x576',
      selectedCombinedOption: COMBINED_RATIO_RESOLUTION_OPTIONS.find(opt => opt.id === '16:9-1024x576') || COMBINED_RATIO_RESOLUTION_OPTIONS[0],
      
      // Processing states (NEW: to preserve ongoing operations)
      isGeneratingVideo: false,
      videoGenerationStatus: '',
      isAddingMotion: false,
      motionStatus: '',
      isUploading: false,
      uploadStatus: '',
      lastProcessingUpdate: '',
      
      // Counts for metadata
      videoCount: 0,
      avatarCount: 0,
    };

    // Store session data
    await db.setDocument('avatar_sessions', sessionId, sessionData);
    
    // Add to global session list
    await db.addToSet('avatar_sessions', 'list', sessionId);
    
    // If productId is provided, add to product-specific list
    if (productId) {
      await db.addToSet('avatar_sessions', `product:${productId}`, sessionId);
    }
    
    return sessionData;
  }

  // Get all avatar sessions (product-specific or global)
  static async getAllSessions(productId?: string): Promise<AvatarSessionMetadata[]> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('🔍 AvatarSessionManager: Getting sessions from database', productId ? `for product ${productId}` : '(global)');
      
      let sessionIds: string[] = [];
      
      if (productId) {
        // Get product-specific sessions
        sessionIds = await db.getSetMembers('avatar_sessions', `product:${productId}`);
        console.log(`📋 AvatarSessionManager: Found ${sessionIds.length} sessions for product ${productId}:`, sessionIds);
      } else {
        // Get global sessions
        sessionIds = await db.getSetMembers('avatar_sessions', 'list');
        console.log('📋 AvatarSessionManager: Found global session IDs:', sessionIds);
      }
      
      const sessions: AvatarSessionMetadata[] = [];
      
      for (const sessionId of sessionIds) {
        try {
          const sessionData = await db.getDocument('avatar_sessions', sessionId);
          if (sessionData) {
            sessions.push({
              id: sessionData.id,
              productId: sessionData.productId,
              name: sessionData.name,
              createdAt: sessionData.createdAt,
              updatedAt: sessionData.updatedAt,
              avatarCount: sessionData.avatarCount || 0,
              videoCount: sessionData.videoCount || 0,
              isProcessing: sessionData.isProcessing || false,
              processingStatus: sessionData.processingStatus || null,
              hasAvatarGroup: !!sessionData.avatarGroup,
              errorCount: sessionData.errors?.length || 0,
            });
          }
        } catch (error) {
          console.error(`Error loading avatar session ${sessionId}:`, error);
        }
      }
      
      // Sort by updatedAt descending
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
    } catch (error) {
      console.error('❌ AvatarSessionManager: Error getting sessions:', error);
      return [];
    }
  }

  // Get session by ID
  static async getSession(sessionId: string): Promise<AvatarSessionData | null> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('🔍 AvatarSessionManager: Getting session from database:', sessionId);
      const sessionData = await db.getDocument('avatar_sessions', sessionId);
      
      if (sessionData) {
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
    const db = getDatabaseAdapter();
    
    try {
      console.log('💾 AvatarSessionManager: Saving session to database:', sessionData.id);
      
      // Update timestamp and counts
      sessionData.updatedAt = new Date().toISOString();
      sessionData.avatarCount = (sessionData.uploadedAssets?.length || 0) + 
                               (sessionData.generatedAvatars?.length || 0) + 
                               (sessionData.existingImages?.length || 0);
      sessionData.videoCount = sessionData.generatedVideos?.length || 0;

      // Save updated data
      await db.updateDocument('avatar_sessions', sessionData.id, sessionData);
      
      // Ensure session is in appropriate lists
      await db.addToSet('avatar_sessions', 'list', sessionData.id);
      if (sessionData.productId) {
        await db.addToSet('avatar_sessions', `product:${sessionData.productId}`, sessionData.id);
      }
      
      console.log('✅ AvatarSessionManager: Session saved successfully:', {
        id: sessionData.id,
        productId: sessionData.productId,
        avatarCount: sessionData.avatarCount,
        videoCount: sessionData.videoCount,
        hasAvatarGroup: !!sessionData.avatarGroup
      });
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error saving session ${sessionData.id}:`, error);
      throw error;
    }
  }

  // Update session with partial data
  static async updateSession(sessionId: string, updates: Partial<AvatarSessionData>): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('🔄 AvatarSessionManager: Updating session in database:', sessionId);
      
      // Get existing session data
      const existingData = await db.getDocument('avatar_sessions', sessionId);
      
      if (existingData) {
        // Merge updates
        const updatedData: AvatarSessionData = {
          ...existingData,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        
        // Update counts
        updatedData.avatarCount = (updatedData.uploadedAssets?.length || 0) + 
                                 (updatedData.generatedAvatars?.length || 0) + 
                                 (updatedData.existingImages?.length || 0);
        updatedData.videoCount = updatedData.generatedVideos?.length || 0;

        // Save updated data
        await db.updateDocument('avatar_sessions', sessionId, updatedData);
        
        // Ensure session is in appropriate lists
        await db.addToSet('avatar_sessions', 'list', sessionId);
        if (updatedData.productId) {
          await db.addToSet('avatar_sessions', `product:${updatedData.productId}`, sessionId);
        }
        
        console.log('✅ AvatarSessionManager: Session updated successfully:', {
          id: updatedData.id,
          productId: updatedData.productId,
          avatarCount: updatedData.avatarCount,
          videoCount: updatedData.videoCount,
          hasAvatarGroup: !!updatedData.avatarGroup
        });
      } else {
        throw new Error(`Avatar session ${sessionId} not found`);
      }
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error updating session ${sessionId}:`, error);
      throw error;
    }
  }

  // Save complete session state including all UI data (backward compatibility)
  static async saveCompleteSessionState(sessionData: AvatarSessionData): Promise<void> {
    return await this.saveSession(sessionData);
  }

  // Update session name
  static async updateSessionName(sessionId: string, name: string): Promise<void> {
    await this.updateSession(sessionId, { name });
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

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('🗑️ AvatarSessionManager: Deleting session from database:', sessionId);
      
      // Get session data to find productId
      const sessionData = await db.getDocument('avatar_sessions', sessionId);
      
      // Delete session data
      await db.deleteDocument('avatar_sessions', sessionId);
      
      // Remove from global list
      await db.removeFromSet('avatar_sessions', 'list', sessionId);
      
      // Remove from product-specific list if applicable
      if (sessionData?.productId) {
        await db.removeFromSet('avatar_sessions', `product:${sessionData.productId}`, sessionId);
      }
      
      console.log('✅ AvatarSessionManager: Session deleted successfully:', sessionId);
      
    } catch (error) {
      console.error(`❌ AvatarSessionManager: Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get sessions by product ID
  static async getSessionsByProduct(productId: string): Promise<AvatarSessionMetadata[]> {
    return await this.getAllSessions(productId);
  }

  // Get global sessions count
  static async getGlobalSessionsCount(): Promise<number> {
    const db = getDatabaseAdapter();
    return await db.getSetSize('avatar_sessions', 'list');
  }

  // Get product sessions count
  static async getProductSessionsCount(productId: string): Promise<number> {
    const db = getDatabaseAdapter();
    return await db.getSetSize('avatar_sessions', `product:${productId}`);
  }
} 