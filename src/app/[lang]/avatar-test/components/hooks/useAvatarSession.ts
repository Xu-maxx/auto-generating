import { useState, useEffect } from 'react';
import { AvatarSessionData } from '@/utils/avatarSessionManager';

export const useAvatarSession = () => {
  const [avatarSession, setAvatarSession] = useState<AvatarSessionData | null>(null);

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
              console.log('✅ Loaded existing avatar session:', data.session.id);
              return;
            }
          }
        }
        
        // Create new session if none exists or couldn't be loaded
        const response = await fetch('/api/avatar-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create' })
        });
        
        if (response.ok) {
          const data = await response.json();
          setAvatarSession(data.session);
          localStorage.setItem('avatarSessionId', data.session.id);
          console.log('✅ Created new avatar session:', data.session.id);
        }
      } catch (error) {
        console.error('Error initializing avatar session:', error);
      }
    };

    initializeSession();
  }, []);

  return {
    avatarSession,
    setAvatarSession
  };
}; 