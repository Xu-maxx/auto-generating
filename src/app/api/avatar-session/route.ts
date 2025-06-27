import { NextRequest, NextResponse } from 'next/server';
import { AvatarSessionManager, AvatarSessionData } from '@/utils/avatarSessionManager';

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId, sessionData, assetId, motionAvatarId } = await request.json();

    switch (action) {
      case 'create':
        try {
          const newSession = await AvatarSessionManager.createSession();
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