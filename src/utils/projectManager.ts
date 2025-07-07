import { getDatabaseAdapter } from './database';
import { ProjectData, ProjectMetadata } from '@/types/project';

export class ProjectManager {
  
  // Generate a unique project ID
  static generateProjectId(): string {
    return `proj_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new project
  static async createProject(name: string, style: string): Promise<ProjectData> {
    const db = getDatabaseAdapter();
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
    await db.setDocument('projects', projectId, projectData);
    
    // Add to project list
    await db.addToSet('projects', 'list', projectId);
    
    return projectData;
  }

  // Get all projects metadata
  static async getAllProjects(): Promise<ProjectMetadata[]> {
    const db = getDatabaseAdapter();
    const projectIds = await db.getSetMembers('projects', 'list');
    
    const projects: ProjectMetadata[] = [];
    
    for (const projectId of projectIds) {
      try {
        const projectData = await db.getDocument('projects', projectId);
        if (projectData) {
          // Get session count
          const sessionCount = await db.getSetSize('projects', `sessions:${projectId}`);
          
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
    const db = getDatabaseAdapter();
    
    try {
      console.log('🔍 ProjectManager: Getting project from database:', projectId);
      const projectData = await db.getDocument('projects', projectId);
      
      if (projectData) {
        // Get current session count
        const sessionCount = await db.getSetSize('projects', `sessions:${projectId}`);
        projectData.sessionCount = sessionCount;
        
        console.log('✅ ProjectManager: Project found in database:', {
          id: projectData.id,
          name: projectData.name,
          style: projectData.style,
          sessionCount: sessionCount
        });
        return projectData;
      } else {
        console.log('❌ ProjectManager: Project not found in database:', projectId);
      }
    } catch (error) {
      console.error(`❌ ProjectManager: Error loading project ${projectId}:`, error);
    }
    
    return null;
  }

  // Update project
  static async updateProject(projectData: Partial<ProjectData> & { id: string }): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      console.log('💾 ProjectManager: Updating project in database:', {
        id: projectData.id,
        updates: Object.keys(projectData)
      });
      
      // Get existing project data
      const existingData = await db.getDocument('projects', projectData.id);
      
      if (existingData) {
        // Merge updates
        const updatedData: ProjectData = {
          ...existingData,
          ...projectData,
          updatedAt: new Date().toISOString(),
        };

        // Save updated data
        await db.updateDocument('projects', projectData.id, updatedData);
        
        console.log('✅ ProjectManager: Project updated in database successfully:', {
          id: updatedData.id,
          name: updatedData.name,
          style: updatedData.style
        });
      } else {
        throw new Error(`Project ${projectData.id} not found`);
      }
    } catch (error) {
      console.error(`❌ ProjectManager: Error updating project ${projectData.id}:`, error);
      throw error;
    }
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    const db = getDatabaseAdapter();
    
    try {
      // Delete project data
      await db.deleteDocument('projects', projectId);
      
      // Remove from project list
      await db.removeFromSet('projects', 'list', projectId);
      
      // Clean up project sessions list
      const sessionIds = await db.getSetMembers('projects', `sessions:${projectId}`);
      for (const sessionId of sessionIds) {
        await db.removeFromSet('projects', `sessions:${projectId}`, sessionId);
      }
      
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      throw error;
    }
  }

  // Add session to project
  static async addSessionToProject(projectId: string, sessionId: string): Promise<void> {
    const db = getDatabaseAdapter();
    await db.addToSet('projects', `sessions:${projectId}`, sessionId);
  }

  // Remove session from project
  static async removeSessionFromProject(projectId: string, sessionId: string): Promise<void> {
    const db = getDatabaseAdapter();
    await db.removeFromSet('projects', `sessions:${projectId}`, sessionId);
  }

  // Get all sessions for a project
  static async getProjectSessions(projectId: string): Promise<string[]> {
    const db = getDatabaseAdapter();
    return await db.getSetMembers('projects', `sessions:${projectId}`);
  }
} 