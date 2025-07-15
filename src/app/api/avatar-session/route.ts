import { NextRequest, NextResponse } from 'next/server';
import { AvatarSessionManager, AvatarSessionData } from '@/utils/avatarSessionManager';

// Rate limiting to prevent excessive saves
const saveRequestTimes = new Map<string, number>();
const MIN_SAVE_INTERVAL = 2000; // 2 seconds minimum between saves

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
        
        // Rate limiting to prevent excessive saves
        const now = Date.now();
        const lastSaveTime = saveRequestTimes.get(sessionData.id) || 0;
        
        if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
          console.log(`⏸️ Rate limiting save for session ${sessionData.id} - too frequent`);
          return NextResponse.json({ 
            success: true, 
            session: sessionData, // Return the data as-is without saving
            message: 'Save skipped due to rate limiting'
          });
        }
        
        try {
          await AvatarSessionManager.saveSession(sessionData as AvatarSessionData);
          saveRequestTimes.set(sessionData.id, now);
          
          // Don't immediately fetch the session - just return success
          // This breaks the save -> get -> save cycle
          return NextResponse.json({ 
            success: true, 
            session: sessionData, // Return the data that was just saved
            message: 'Session saved successfully'
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
        
        // Rate limiting for complete saves too
        const nowComplete = Date.now();
        const lastCompleteTime = saveRequestTimes.get(sessionData.id) || 0;
        
        if (nowComplete - lastCompleteTime < MIN_SAVE_INTERVAL) {
          console.log(`⏸️ Rate limiting complete save for session ${sessionData.id} - too frequent`);
          return NextResponse.json({ 
            success: true, 
            session: sessionData,
            message: 'Complete save skipped due to rate limiting'
          });
        }
        
        try {
          await AvatarSessionManager.saveCompleteSessionState(sessionData as AvatarSessionData);
          saveRequestTimes.set(sessionData.id, nowComplete);
          
          // Don't immediately fetch the session - just return the saved data
          return NextResponse.json({ 
            success: true, 
            session: sessionData,
            message: 'Complete session saved successfully'
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
          return NextResponse.json({ error: 'Session ID and name required' }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.updateSessionName(sessionId, name);
          const updatedSession = await AvatarSessionManager.getSession(sessionId);
          return NextResponse.json({ 
            success: true, 
            session: updatedSession 
          });
        } catch (error) {
          console.error('Error updating avatar session name:', error);
          return NextResponse.json(
            { error: 'Failed to update avatar session name' },
            { status: 500 }
          );
        }

      case 'delete':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        
        try {
          await AvatarSessionManager.deleteSession(sessionId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('Error deleting avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to delete avatar session' },
            { status: 500 }
          );
        }

      case 'addAsset':
        if (!sessionId || !assetId) {
          return NextResponse.json({ error: 'Session ID and asset ID required' }, { status: 400 });
        }
        
        try {
          // This would need to be implemented in AvatarSessionManager
          // await AvatarSessionManager.addAssetToSession(sessionId, assetId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('Error adding asset to avatar session:', error);
          return NextResponse.json(
            { error: 'Failed to add asset to avatar session' },
            { status: 500 }
          );
        }

      case 'addMotionAvatar':
        if (!sessionId || !motionAvatarId) {
          return NextResponse.json({ error: 'Session ID and motion avatar ID required' }, { status: 400 });
        }
        
        try {
          // This would need to be implemented in AvatarSessionManager
          // await AvatarSessionManager.addMotionAvatarToSession(sessionId, motionAvatarId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error('Error adding motion avatar to session:', error);
          return NextResponse.json(
            { error: 'Failed to add motion avatar to session' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in avatar session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 