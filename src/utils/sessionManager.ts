import { getDatabaseAdapter } from './database';
import { SessionData, SessionMetadata, GeneratedImage, VideoGenerationTask } from '@/types/session';
import { ProjectManager } from './projectManager';

const SESSION_PREFIX = 'session:';
const SESSION_LIST_KEY = 'sessions:list';
const PRODUCT_SESSIONS_PREFIX = 'product:sessions:';

export class SessionManager {
  
  // Generate a unique session ID
  static generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new session for a product
  static async createSessionForProduct(name?: string, productId?: string): Promise<SessionData> {
    const db = getDatabaseAdapter();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: SessionData = {
      id: sessionId,
      projectId: productId || '', // Store product ID in projectId field for backward compatibility
      name: name || 'Untitled',
      createdAt: now,
      updatedAt: now,
      
      // Form states
      imageDataUrl: '',
      videoPrompt: '',
      folderName: '',
      selectedTags: [], // Initialize selectedTags as empty array
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
    await db.setDocument('sessions', sessionId, sessionData);
    
    // Add to session list
    await db.addToSet('sessions', 'list', sessionId);
    
    // If productId is provided, add session to product
    if (productId) {
      await db.addToSet('sessions', `product:${productId}`, sessionId);
    }
    
    return sessionData;
  }

  // Get all sessions for a product
  static async getSessionsForProduct(productId: string): Promise<SessionMetadata[]> {
    const db = getDatabaseAdapter();
    const sessionIds = await db.getSetMembers('sessions', `product:${productId}`);
    
    const sessions: SessionMetadata[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const sessionData = await db.getDocument('sessions', sessionId);
        if (sessionData) {
          sessions.push({
            id: sessionData.id,
            projectId: sessionData.projectId,
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            imageCount: (sessionData.selectedImages?.length || 0) + (sessionData.addedImages?.length || 0),
            videoCount: sessionData.videoTasks?.length || 0,
          });
        }
      } catch (error) {
        console.error(`Error loading session ${sessionId}:`, error);
      }
    }
    
    // Sort by updatedAt descending
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Create a new session
  static async createSession(name?: string, projectId?: string): Promise<SessionData> {
    const db = getDatabaseAdapter();
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const sessionData: SessionData = {
      id: sessionId,
      projectId: projectId || '',
      name: name || 'Untitled',
      createdAt: now,
      updatedAt: now,
      
      // Form states
      imageDataUrl: '',
      videoPrompt: '',
      folderName: '',
      selectedTags: [], // Initialize selectedTags as empty array
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
    await db.setDocument('sessions', sessionId, sessionData);
    
    // Add to session list
    await db.addToSet('sessions', 'list', sessionId);
    
    // If projectId is provided, add session to project
    if (projectId) {
      await ProjectManager.addSessionToProject(projectId, sessionId);
    }
    
    return sessionData;
  }

  // Get all sessions
  static async getAllSessions(): Promise<SessionMetadata[]> {
    const db = getDatabaseAdapter();
    const sessionIds = await db.getSetMembers('sessions', 'list');
    
    const sessions: SessionMetadata[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const sessionData = await db.getDocument('sessions', sessionId);
        if (sessionData) {
          sessions.push({
            id: sessionData.id,
            projectId: sessionData.projectId,
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            imageCount: (sessionData.selectedImages?.length || 0) + (sessionData.addedImages?.length || 0),
            videoCount: sessionData.videoTasks?.length || 0,
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
    const db = getDatabaseAdapter();
    
    try {
      console.log('🔍 SessionManager: Getting session from database:', sessionId);
      const sessionData = await db.getDocument('sessions', sessionId);
      
      if (sessionData) {
        console.log('✅ SessionManager: Session found in database:', {
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
        console.log('❌ SessionManager: Session not found in database:', sessionId);
      }
    } catch (error) {
      console.error(`❌ SessionManager: Error loading session ${sessionId}:`, error);
    }
    
    return null;
  }

  // Save/update session
  static async saveSession(sessionData: Partial<SessionData> & { id: string }): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('💾 SessionManager: Saving session to database:', {
        id: sessionData.id,
        updates: Object.keys(sessionData)
      });
      
      // Get existing session data
      const existingData = await db.getDocument('sessions', sessionData.id);
      let updatedData: SessionData;
      
      if (existingData) {
        // Merge updates
        updatedData = {
          ...existingData,
          ...sessionData,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // If session doesn't exist, create default structure
        updatedData = {
          id: sessionData.id,
          projectId: sessionData.projectId || '',
          name: sessionData.name || 'Untitled',
          createdAt: sessionData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          imageDataUrl: sessionData.imageDataUrl || '',
          videoPrompt: sessionData.videoPrompt || '',
          folderName: sessionData.folderName || '',
          selectedTags: sessionData.selectedTags || [], // Initialize selectedTags as empty array
          aspectRatio: sessionData.aspectRatio || '16:9',
          
          // Image generation settings
          imageAspectRatio: sessionData.imageAspectRatio || '16:9',
          imageResolution: sessionData.imageResolution || {width: 1920, height: 1080},
          
          selectedImages: sessionData.selectedImages || [],
          addedImages: sessionData.addedImages || [],
          referenceImages: sessionData.referenceImages || [],
          videoTasks: sessionData.videoTasks || [],
          isGeneratingVideo: sessionData.isGeneratingVideo || false,
          prompts: sessionData.prompts || [],
          conversation: sessionData.conversation || [],
          userRequirement: sessionData.userRequirement || '',
        };
      }

      // Save updated data
      await db.updateDocument('sessions', sessionData.id, updatedData);
      
      console.log('✅ SessionManager: Session saved to database successfully:', {
        id: updatedData.id,
        name: updatedData.name,
        promptsCount: updatedData.prompts?.length || 0,
        conversationLength: updatedData.conversation?.length || 0,
        addedImagesCount: updatedData.addedImages?.length || 0,
        videoTasksCount: updatedData.videoTasks?.length || 0
      });
      
      // Ensure session is in session list
      await db.addToSet('sessions', 'list', sessionData.id);
      
      // If projectId is provided, ensure session is associated with project
      if (updatedData.projectId) {
        if (/^\d+$/.test(updatedData.projectId)) {
          // This is a product ID
          await db.addToSet('sessions', `product:${updatedData.projectId}`, sessionData.id);
        } else {
          // This is a project ID
          await ProjectManager.addSessionToProject(updatedData.projectId, sessionData.id);
        }
      }
      
    } catch (error) {
      console.error(`❌ SessionManager: Error saving session ${sessionData.id}:`, error);
      throw error;
    }
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      // Get session data to find projectId/productId
      const sessionData = await db.getDocument('sessions', sessionId);
      if (sessionData) {
        if (sessionData.projectId) {
          // Check if this is a product ID (numeric) or project ID (starts with proj_)
          if (/^\d+$/.test(sessionData.projectId)) {
            // This is a product ID
            await db.removeFromSet('sessions', `product:${sessionData.projectId}`, sessionId);
          } else {
            // This is a project ID
            await ProjectManager.removeSessionFromProject(sessionData.projectId, sessionId);
          }
        }
      }
      
      await db.deleteDocument('sessions', sessionId);
      await db.removeFromSet('sessions', 'list', sessionId);
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get all sessions for a project
  static async getSessionsForProject(projectId: string): Promise<SessionMetadata[]> {
    const db = getDatabaseAdapter();
    const sessionIds = await ProjectManager.getProjectSessions(projectId);
    
    const sessions: SessionMetadata[] = [];
    
    for (const sessionId of sessionIds) {
      try {
        const sessionData = await db.getDocument('sessions', sessionId);
        if (sessionData) {
          sessions.push({
            id: sessionData.id,
            projectId: sessionData.projectId,
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            imageCount: (sessionData.selectedImages?.length || 0) + (sessionData.addedImages?.length || 0),
            videoCount: sessionData.videoTasks?.length || 0,
          });
        }
      } catch (error) {
        console.error(`Error loading session ${sessionId}:`, error);
      }
    }
    
    // Sort by updatedAt descending
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Get all sessions for a product (alias method for backward compatibility)
  static async getSessionsByProduct(productId: string): Promise<SessionMetadata[]> {
    return await this.getSessionsForProduct(productId);
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