import { getRedisClient } from './redis';
import { SessionData, SessionMetadata, GeneratedImage, VideoGenerationTask } from '@/types/session';
import { ProjectManager } from './projectManager';

const SESSION_PREFIX = 'session:';
const SESSION_LIST_KEY = 'sessions:list';

export class SessionManager {
  
  // Generate a unique session ID
  static generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new session
  static async createSession(name?: string, projectId?: string): Promise<SessionData> {
    const redis = await getRedisClient();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: SessionData = {
      id: sessionId,
      projectId: projectId || '', // Default to empty string for backward compatibility
      name: name || 'Untitled',
      createdAt: now,
      updatedAt: now,
      
      // Form states
      imageDataUrl: '',
      videoPrompt: '',
      folderName: '',
      aspectRatio: '16:9',
      
      // Image generation settings
      imageAspectRatio: '16:9',
      imageResolution: {width: 1920, height: 1080},
      
      // Image states
      selectedImages: [],
      addedImages: [],
      referenceImages: [],
      
      // Video states
      videoTasks: [],
      isGeneratingVideo: false,
      
      // Prompt generation states
      prompts: [],
      conversation: [],
      userRequirement: '',
    };

    // Store session data
    await redis.hSet(`${SESSION_PREFIX}${sessionId}`, 'data', JSON.stringify(sessionData));
    
    // Add to session list
    await redis.sAdd(SESSION_LIST_KEY, sessionId);
    
    // If projectId is provided, add session to project
    if (projectId) {
      await ProjectManager.addSessionToProject(projectId, sessionId);
    }
    
    return sessionData;
  }

  // Get all sessions metadata
  static async getAllSessions(): Promise<SessionMetadata[]> {
    const redis = await getRedisClient();
    const sessionIds = await redis.sMembers(SESSION_LIST_KEY);
    
    const sessions: SessionMetadata[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const sessionDataStr = await redis.hGet(`${SESSION_PREFIX}${sessionId}`, 'data');
        if (sessionDataStr) {
          const sessionData: SessionData = JSON.parse(sessionDataStr);
          sessions.push({
            id: sessionData.id,
            projectId: sessionData.projectId || '', // Handle legacy sessions without projectId
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            imageCount: sessionData.addedImages.length,
            videoCount: sessionData.videoTasks.filter(task => task.status === 'downloaded').length,
          });
        }
      } catch (error) {
        console.error(`Error loading session ${sessionId}:`, error);
      }
    }
    
    // Sort by updatedAt descending
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Get all sessions for a specific project
  static async getSessionsByProject(projectId: string): Promise<SessionMetadata[]> {
    const redis = await getRedisClient();
    const sessionIds = await ProjectManager.getProjectSessions(projectId);
    
    const sessions: SessionMetadata[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const sessionDataStr = await redis.hGet(`${SESSION_PREFIX}${sessionId}`, 'data');
        if (sessionDataStr) {
          const sessionData: SessionData = JSON.parse(sessionDataStr);
          sessions.push({
            id: sessionData.id,
            projectId: sessionData.projectId,
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            imageCount: sessionData.addedImages.length,
            videoCount: sessionData.videoTasks.filter(task => task.status === 'downloaded').length,
          });
        }
      } catch (error) {
        console.error(`Error loading session ${sessionId}:`, error);
      }
    }
    
    // Sort by updatedAt descending
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Get session by ID
  static async getSession(sessionId: string): Promise<SessionData | null> {
    const redis = await getRedisClient();
    
    try {
      console.log('🔍 SessionManager: Getting session from Redis:', sessionId);
      const sessionDataStr = await redis.hGet(`${SESSION_PREFIX}${sessionId}`, 'data');
      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        console.log('✅ SessionManager: Session found in Redis:', {
          id: sessionData.id,
          name: sessionData.name,
          promptsCount: sessionData.prompts?.length || 0,
          conversationLength: sessionData.conversation?.length || 0,
          addedImagesCount: sessionData.addedImages?.length || 0,
          addedImagesDetails: sessionData.addedImages?.map((img: any) => ({ taskId: img.taskId, filename: img.filename })) || [],
          videoTasksCount: sessionData.videoTasks?.length || 0
        });
        return sessionData;
      } else {
        console.log('❌ SessionManager: Session not found in Redis:', sessionId);
      }
    } catch (error) {
      console.error(`❌ SessionManager: Error loading session ${sessionId}:`, error);
    }
    
    return null;
  }

  // Save/update session
  static async saveSession(sessionData: Partial<SessionData> & { id: string }): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      console.log('💾 SessionManager: Saving session to Redis:', {
        id: sessionData.id,
        updates: Object.keys(sessionData)
      });
      
      // Get existing session data
      const existingDataStr = await redis.hGet(`${SESSION_PREFIX}${sessionData.id}`, 'data');
      let existingData: SessionData;
      
      if (existingDataStr) {
        existingData = JSON.parse(existingDataStr);
      } else {
        // If session doesn't exist, create default structure
        existingData = {
          id: sessionData.id,
          projectId: sessionData.projectId || '', // Handle projectId for new sessions
          name: 'Untitled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          imageDataUrl: '',
          videoPrompt: '',
          folderName: '',
          aspectRatio: '16:9',
          
          // Image generation settings
          imageAspectRatio: '16:9',
          imageResolution: {width: 1920, height: 1080},
          
          selectedImages: [],
          addedImages: [],
          referenceImages: [],
          videoTasks: [],
          isGeneratingVideo: false,
          prompts: [],
          conversation: [],
          userRequirement: '',
        };
      }

      // Merge updates
      const updatedData: SessionData = {
        ...existingData,
        ...sessionData,
        updatedAt: new Date().toISOString(),
      };

      // Save updated data
      await redis.hSet(`${SESSION_PREFIX}${sessionData.id}`, 'data', JSON.stringify(updatedData));
      
      console.log('✅ SessionManager: Session saved to Redis successfully:', {
        id: updatedData.id,
        projectId: updatedData.projectId,
        promptsCount: updatedData.prompts?.length || 0,
        conversationLength: updatedData.conversation?.length || 0,
        addedImagesCount: updatedData.addedImages?.length || 0,
        addedImagesDetails: updatedData.addedImages?.map((img: any) => ({ taskId: img.taskId, filename: img.filename })) || [],
        videoTasksCount: updatedData.videoTasks?.length || 0
      });
      
      // Ensure session is in the list
      await redis.sAdd(SESSION_LIST_KEY, sessionData.id);
      
    } catch (error) {
      console.error(`❌ SessionManager: Error saving session ${sessionData.id}:`, error);
      throw error;
    }
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      // Get session data to find projectId
      const sessionDataStr = await redis.hGet(`${SESSION_PREFIX}${sessionId}`, 'data');
      if (sessionDataStr) {
        const sessionData: SessionData = JSON.parse(sessionDataStr);
        if (sessionData.projectId) {
          await ProjectManager.removeSessionFromProject(sessionData.projectId, sessionId);
        }
      }
      
      await redis.del(`${SESSION_PREFIX}${sessionId}`);
      await redis.sRem(SESSION_LIST_KEY, sessionId);
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Update session name
  static async updateSessionName(sessionId: string, name: string): Promise<void> {
    await this.saveSession({ id: sessionId, name });
  }

  // Auto-save session data
  static async autoSave(sessionId: string, updates: Partial<SessionData>): Promise<void> {
    try {
      await this.saveSession({ id: sessionId, ...updates });
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw error to avoid disrupting user experience
    }
  }
} 