import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/utils/sessionManager';

// GET all sessions
export async function GET() {
  try {
    const sessions = await SessionManager.getAllSessions();
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST create new session
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const session = await SessionManager.createSession(name);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
} 