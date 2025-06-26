import { getRedisClient } from './redis';
import { ProjectData, ProjectMetadata } from '@/types/project';

const PROJECT_PREFIX = 'project:';
const PROJECT_LIST_KEY = 'projects:list';
const PROJECT_SESSIONS_PREFIX = 'project:sessions:';

export class ProjectManager {
  
  // Generate a unique project ID
  static generateProjectId(): string {
    return `proj_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new project
  static async createProject(name: string, style: string): Promise<ProjectData> {
    const redis = await getRedisClient();
    const projectId = this.generateProjectId();
    const now = new Date().toISOString();
    
    const projectData: ProjectData = {
      id: projectId,
      name,
      style,
      createdAt: now,
      updatedAt: now,
      sessionCount: 0,
    };

    // Store project data
    await redis.hSet(`${PROJECT_PREFIX}${projectId}`, 'data', JSON.stringify(projectData));
    
    // Add to project list
    await redis.sAdd(PROJECT_LIST_KEY, projectId);
    
    // Initialize empty sessions set for this project
    await redis.del(`${PROJECT_SESSIONS_PREFIX}${projectId}`);
    
    return projectData;
  }

  // Get all projects metadata
  static async getAllProjects(): Promise<ProjectMetadata[]> {
    const redis = await getRedisClient();
    const projectIds = await redis.sMembers(PROJECT_LIST_KEY);
    
    const projects: ProjectMetadata[] = [];
    
    for (const projectId of projectIds) {
      try {
        const projectDataStr = await redis.hGet(`${PROJECT_PREFIX}${projectId}`, 'data');
        if (projectDataStr) {
          const projectData: ProjectData = JSON.parse(projectDataStr);
          
          // Get session count
          const sessionCount = await redis.sCard(`${PROJECT_SESSIONS_PREFIX}${projectId}`);
          
          projects.push({
            id: projectData.id,
            name: projectData.name,
            style: projectData.style,
            createdAt: projectData.createdAt,
            updatedAt: projectData.updatedAt,
            sessionCount: sessionCount,
          });
        }
      } catch (error) {
        console.error(`Error loading project ${projectId}:`, error);
      }
    }
    
    // Sort by updatedAt descending
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Get project by ID
  static async getProject(projectId: string): Promise<ProjectData | null> {
    const redis = await getRedisClient();
    
    try {
      console.log('🔍 ProjectManager: Getting project from Redis:', projectId);
      const projectDataStr = await redis.hGet(`${PROJECT_PREFIX}${projectId}`, 'data');
      if (projectDataStr) {
        const projectData = JSON.parse(projectDataStr);
        
        // Get current session count
        const sessionCount = await redis.sCard(`${PROJECT_SESSIONS_PREFIX}${projectId}`);
        projectData.sessionCount = sessionCount;
        
        console.log('✅ ProjectManager: Project found in Redis:', {
          id: projectData.id,
          name: projectData.name,
          style: projectData.style,
          sessionCount: sessionCount
        });
        return projectData;
      } else {
        console.log('❌ ProjectManager: Project not found in Redis:', projectId);
      }
    } catch (error) {
      console.error(`❌ ProjectManager: Error loading project ${projectId}:`, error);
    }
    
    return null;
  }

  // Update project
  static async updateProject(projectData: Partial<ProjectData> & { id: string }): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      console.log('💾 ProjectManager: Updating project in Redis:', {
        id: projectData.id,
        updates: Object.keys(projectData)
      });
      
      // Get existing project data
      const existingDataStr = await redis.hGet(`${PROJECT_PREFIX}${projectData.id}`, 'data');
      if (!existingDataStr) {
        throw new Error(`Project ${projectData.id} not found`);
      }
      
      const existingData: ProjectData = JSON.parse(existingDataStr);

      // Merge updates
      const updatedData: ProjectData = {
        ...existingData,
        ...projectData,
        updatedAt: new Date().toISOString(),
      };

      // Save updated data
      await redis.hSet(`${PROJECT_PREFIX}${projectData.id}`, 'data', JSON.stringify(updatedData));
      
      console.log('✅ ProjectManager: Project updated in Redis successfully:', {
        id: updatedData.id,
        name: updatedData.name,
        style: updatedData.style
      });
      
    } catch (error) {
      console.error(`❌ ProjectManager: Error updating project ${projectData.id}:`, error);
      throw error;
    }
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    const redis = await getRedisClient();
    
    try {
      // Delete project data
      await redis.del(`${PROJECT_PREFIX}${projectId}`);
      
      // Remove from project list
      await redis.sRem(PROJECT_LIST_KEY, projectId);
      
      // Clean up project sessions list
      await redis.del(`${PROJECT_SESSIONS_PREFIX}${projectId}`);
      
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      throw error;
    }
  }

  // Add session to project
  static async addSessionToProject(projectId: string, sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.sAdd(`${PROJECT_SESSIONS_PREFIX}${projectId}`, sessionId);
  }

  // Remove session from project
  static async removeSessionFromProject(projectId: string, sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.sRem(`${PROJECT_SESSIONS_PREFIX}${projectId}`, sessionId);
  }

  // Get all sessions for a project
  static async getProjectSessions(projectId: string): Promise<string[]> {
    const redis = await getRedisClient();
    return await redis.sMembers(`${PROJECT_SESSIONS_PREFIX}${projectId}`);
  }
} 