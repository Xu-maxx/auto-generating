import { NextRequest, NextResponse } from 'next/server';
import { AvatarSessionManager, AvatarSessionData } from '@/utils/avatarSessionManager';

// GET all avatar sessions (product-specific or global)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || undefined;
    
    const sessions = await AvatarSessionManager.getAllSessions(productId);
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error('Error getting avatar sessions:', error);
    return NextResponse.json(
      { error: 'Failed to get avatar sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, sessionData, assetId, motionAvatarId, name, productId } = await request.json();

    switch (action) {
      case 'create':
        try {
          const newSession = await AvatarSessionManager.createSession(name, productId);
          return NextResponse.json({ 
            success: true, 
            session: newSession 
          });
        } catch (error) {
          console.error('Error creating avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to create avatar session' },
            { status: 500 }
          );
        }

      case 'get':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        
        try {
          const session = await AvatarSessionManager.getSession(sessionId);
          return NextResponse.json({ 
            success: true, 
            session: session 
          });
        } catch (error) {
          console.error('Error getting avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to get avatar session' },
            { status: 500 }
          );
        }

      case 'save':
        if (!sessionData) {
          return NextResponse.json({ error: 'Session data required' }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.saveSession(sessionData as AvatarSessionData);
          const updatedSession = await AvatarSessionManager.getSession(sessionData.id);
          return NextResponse.json({ 
            success: true, 
            session: updatedSession 
          });
        } catch (error) {
          console.error('Error saving avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to save avatar session' },
            { status: 500 }
          );
        }

      case 'saveComplete':
        if (!sessionData) {
          return NextResponse.json({ error: 'Session data required' }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.saveCompleteSessionState(sessionData as AvatarSessionData);
          const updatedSession = await AvatarSessionManager.getSession(sessionData.id);
          return NextResponse.json({ 
            success: true, 
            session: updatedSession 
          });
        } catch (error) {
          console.error('Error saving complete avatar session state:', error);
          return NextResponse.json(
            { error: 'Failed to save complete avatar session state' },
            { status: 500 }
          );
        }

      case 'updateName':
        if (!sessionId || !name) {
          return NextResponse.json({ 
            error: 'Session ID and name required' 
          }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.updateSessionName(sessionId, name);
          const updatedSession = await AvatarSessionManager.getSession(sessionId);
          return NextResponse.json({ 
            success: true, 
            session: updatedSession 
          });
        } catch (error) {
          console.error('Error updating session name:', error);
          return NextResponse.json(
            { error: 'Failed to update session name' },
            { status: 500 }
          );
        }

      case 'addMotion':
        if (!sessionId || !assetId || !motionAvatarId) {
          return NextResponse.json({ 
            error: 'Session ID, asset ID, and motion avatar ID required' 
          }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.addMotionToAsset(sessionId, assetId, motionAvatarId);
          const updatedSession = await AvatarSessionManager.getSession(sessionId);
          return NextResponse.json({ 
            success: true, 
            session: updatedSession 
          });
        } catch (error) {
          console.error('Error adding motion to asset:', error);
          return NextResponse.json(
            { error: 'Failed to add motion to asset' },
            { status: 500 }
          );
        }

      case 'delete':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.deleteSession(sessionId);
          return NextResponse.json({ 
            success: true, 
            message: 'Avatar session deleted' 
          });
        } catch (error) {
          console.error('Error deleting avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to delete avatar session' },
            { status: 500 }
          );
        }

      case 'cleanup':
        try {
          await AvatarSessionManager.cleanupOldSessions();
          return NextResponse.json({ 
            success: true, 
            message: 'Old sessions cleaned up' 
          });
        } catch (error) {
          console.error('Error cleaning up old sessions:', error);
          return NextResponse.json(
            { error: 'Failed to cleanup old sessions' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in avatar session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 