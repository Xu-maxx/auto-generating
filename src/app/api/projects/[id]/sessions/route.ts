import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/utils/sessionManager';
import { ProjectManager } from '@/utils/projectManager';

// GET all sessions for a project
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    
    // Verify project exists
    const project = await ProjectManager.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    const sessions = await SessionManager.getSessionsByProject(projectId);
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching project sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch project sessions' },
      { status: 500 }
    );
  }
}

// POST create new session in project
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const { name } = await request.json();
    
    // Verify project exists
    const project = await ProjectManager.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }
    
    const session = await SessionManager.createSession(name || 'Untitled', projectId);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
} 