import { useState, useEffect } from 'react';
import { AvatarSessionData, AvatarSessionManager } from '@/utils/avatarSessionManager';

export const useAvatarSession = () => {
  const [avatarSession, setAvatarSession] = useState<AvatarSessionData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Initialize or get avatar session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Check if we have a session ID in localStorage
        const storedSessionId = localStorage.getItem('avatarSessionId');
        
        if (storedSessionId) {
          // Try to get existing session
          const response = await fetch('/api/avatar-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', sessionId: storedSessionId })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.session) {
              setAvatarSession(data.session);
              setCurrentSessionId(data.session.id);
              console.log('✅ Loaded existing avatar session:', data.session.id);
              return;
            }
          }
        }
        
        // Create new session if none exists or couldn't be loaded
        const response = await fetch('/api/avatar-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', name: 'My First Avatar Session' })
        });
        
        if (response.ok) {
          const data = await response.json();
          setAvatarSession(data.session);
          setCurrentSessionId(data.session.id);
          localStorage.setItem('avatarSessionId', data.session.id);
          console.log('✅ Created new avatar session:', data.session.id);
        }
      } catch (error) {
        console.error('Error initializing avatar session:', error);
      }
    };

    initializeSession();
  }, []);

  // Load a specific session
  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', sessionId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setAvatarSession(data.session);
          setCurrentSessionId(sessionId);
          localStorage.setItem('avatarSessionId', sessionId);
          console.log('✅ Loaded avatar session:', sessionId);
          return data.session;
        }
      }
    } catch (error) {
      console.error('Error loading avatar session:', error);
    }
    return null;
  };

  // Create a new session
  const createNewSession = async (name?: string) => {
    try {
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: name || 'New Avatar Session' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvatarSession(data.session);
        setCurrentSessionId(data.session.id);
        localStorage.setItem('avatarSessionId', data.session.id);
        console.log('✅ Created new avatar session:', data.session.id);
        return data.session;
      }
    } catch (error) {
      console.error('Error creating avatar session:', error);
    }
    return null;
  };

  // Save complete session state
  const saveCompleteSessionState = async (sessionData: AvatarSessionData) => {
    try {
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveComplete', sessionData })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setAvatarSession(data.session);
          console.log('✅ Saved complete session state:', sessionData.id);
          return data.session;
        }
      }
    } catch (error) {
      console.error('Error saving complete session state:', error);
    }
    return null;
  };

  return {
    avatarSession,
    setAvatarSession,
    currentSessionId,
    loadSession,
    createNewSession,
    saveCompleteSessionState
  };
}; 