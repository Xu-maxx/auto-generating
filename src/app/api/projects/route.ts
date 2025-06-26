import { NextRequest, NextResponse } from 'next/server';
import { ProjectManager } from '@/utils/projectManager';

// GET all projects
export async function GET() {
  try {
    const projects = await ProjectManager.getAllProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST create new project
export async function POST(request: NextRequest) {
  try {
    const { name, style } = await request.json();
    
    if (!name || !style) {
      return NextResponse.json(
        { success: false, error: 'Project name and style are required' },
        { status: 400 }
      );
    }
    
    const project = await ProjectManager.createProject(name, style);
    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 