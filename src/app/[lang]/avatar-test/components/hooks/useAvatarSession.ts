import { useState, useEffect, useCallback } from 'react';
import { AvatarSessionData, AvatarSessionManager } from '@/utils/avatarSessionManager';

export const useAvatarSession = (productId?: string) => {
  const [avatarSession, setAvatarSession] = useState<AvatarSessionData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Initialize or get avatar session on component mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Create a storage key that includes product ID if provided
        const storageKey = productId ? `avatarSessionId_product_${productId}` : 'avatarSessionId';
        
        // Check if we have a session ID in localStorage for this product
        const storedSessionId = localStorage.getItem(storageKey);
        
        if (storedSessionId) {
          // Try to get existing session
          const response = await fetch('/api/avatar-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', sessionId: storedSessionId, productId })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.session) {
              // Verify session belongs to this product (if productId is specified)
              if (!productId || data.session.productId === productId) {
                setAvatarSession(data.session);
                setCurrentSessionId(data.session.id);
                console.log('✅ Loaded existing avatar session:', data.session.id, productId ? `for product ${productId}` : '(global)');
                return;
              } else {
                console.log('⚠️ Session product mismatch, creating new session');
                localStorage.removeItem(storageKey);
              }
            }
          }
        }
        
        // Create new session if none exists or couldn't be loaded
        const sessionName = productId ? `Product ${productId} Avatar Session` : 'My First Avatar Session';
        const response = await fetch('/api/avatar-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', name: sessionName, productId })
        });
        
        if (response.ok) {
          const data = await response.json();
          setAvatarSession(data.session);
          setCurrentSessionId(data.session.id);
          localStorage.setItem(storageKey, data.session.id);
          console.log('✅ Created new avatar session:', data.session.id, productId ? `for product ${productId}` : '(global)');
        }
      } catch (error) {
        console.error('Error initializing avatar session:', error);
      }
    };

    initializeSession();
  }, [productId]); // Add productId as dependency

  // Load a specific session
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', sessionId, productId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          // Verify session belongs to this product (if productId is specified)
          if (!productId || data.session.productId === productId) {
            setAvatarSession(data.session);
            setCurrentSessionId(sessionId);
            const storageKey = productId ? `avatarSessionId_product_${productId}` : 'avatarSessionId';
            localStorage.setItem(storageKey, sessionId);
            console.log('✅ Loaded avatar session:', sessionId, productId ? `for product ${productId}` : '(global)');
            return data.session;
          } else {
            console.warn('⚠️ Session does not belong to current product');
          }
        }
      }
    } catch (error) {
      console.error('Error loading avatar session:', error);
    }
    return null;
  }, [productId]); // Add productId as dependency

  // Create a new session
  const createNewSession = useCallback(async (name?: string) => {
    try {
      const sessionName = name || (productId ? `Product ${productId} Avatar Session` : 'New Avatar Session');
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: sessionName, productId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvatarSession(data.session);
        setCurrentSessionId(data.session.id);
        const storageKey = productId ? `avatarSessionId_product_${productId}` : 'avatarSessionId';
        localStorage.setItem(storageKey, data.session.id);
        console.log('✅ Created new avatar session:', data.session.id, productId ? `for product ${productId}` : '(global)');
        return data.session;
      }
    } catch (error) {
      console.error('Error creating avatar session:', error);
    }
    return null;
  }, [productId]); // Add productId as dependency

  // Save complete session state - FIXED: Don't update local state again to avoid loops
  const saveCompleteSessionState = useCallback(async (sessionData: AvatarSessionData) => {
    try {
      const response = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveComplete', sessionData, productId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          console.log('✅ Saved complete session state:', sessionData.id, productId ? `for product ${productId}` : '(global)');
          return data.session;
        }
      }
    } catch (error) {
      console.error('Error saving complete session state:', error);
    }
    return null;
  }, [productId]); // Add productId as dependency

  return {
    avatarSession,
    setAvatarSession,
    currentSessionId,
    loadSession,
    createNewSession,
    saveCompleteSessionState
  };
}; 