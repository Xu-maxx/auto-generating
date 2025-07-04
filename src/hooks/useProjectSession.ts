import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionData } from '@/types/session';
import ApiClient from '@/utils/apiClient';

export function useProjectSession(projectId: string) {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<SessionData>>({});

  // Get authentication headers
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const apiClient = ApiClient.getInstance();
    const token = apiClient.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  // Load session from API
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      console.log('🔄 Loading session:', sessionId);
      setLoading(true);
      
      // Clear any pending auto-save before loading new session
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
        pendingUpdatesRef.current = {}; // Clear pending updates
        console.log('🧹 Cleared pending auto-save before loading session');
      }
      
      const response = await fetch(`/api/sessions/${sessionId}`);
      const data = await response.json();
      if (data.success) {
        console.log('✅ Session loaded successfully:', data.session);
        setCurrentSession(data.session);
      } else {
        console.error('❌ Failed to load session:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session in project
  const createSession = useCallback(async (name?: string) => {
    try {
      console.log('🆕 Creating new session for product:', projectId, name || 'Untitled');
      
      // Check if projectId is numeric (product ID) or starts with proj_ (project ID)
      const isProductId = /^\d+$/.test(projectId);
      const endpoint = isProductId ? `/api/products/${projectId}/sessions` : `/api/projects/${projectId}/sessions`;
      
      const headers = { 'Content-Type': 'application/json' };
      if (isProductId) {
        Object.assign(headers, getAuthHeaders());
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name || 'Untitled' }),
      });
      const data = await response.json();
      if (data.success) {
        console.log('✅ Session created successfully:', data.session);
        setCurrentSession(data.session);
        return data.session;
      }
    } catch (error) {
      console.error('❌ Error creating session:', error);
    }
    return null;
  }, [projectId, getAuthHeaders]);

  // Auto-save with debouncing
  const autoSave = useCallback((updates: Partial<SessionData>) => {
    if (!currentSession) return;

    // Accumulate updates instead of overwriting
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

    // Special debug for video tasks
    if (updates.videoTasks || pendingUpdatesRef.current.videoTasks) {
      console.log('🚨 AUTO-SAVE VIDEO TASKS DEBUG:', {
        sessionId: currentSession.id,
        newUpdatesHasVideoTasks: !!updates.videoTasks,
        newUpdatesVideoTasksCount: updates.videoTasks?.length || 0,
        pendingUpdatesHasVideoTasks: !!pendingUpdatesRef.current.videoTasks,
        pendingUpdatesVideoTasksCount: pendingUpdatesRef.current.videoTasks?.length || 0,
        pendingVideoTasksDetails: pendingUpdatesRef.current.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })) || []
      });
    }

    console.log('💾 Auto-saving session updates:', {
      newUpdates: Object.keys(updates),
      allPendingUpdates: Object.keys(pendingUpdatesRef.current),
      videoTasksLength: pendingUpdatesRef.current.videoTasks?.length,
      videoTasksDetails: pendingUpdatesRef.current.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })),
    });

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatesToSave = { ...pendingUpdatesRef.current };
        pendingUpdatesRef.current = {}; // Clear pending updates
        
        // Special debug for video tasks being saved
        if (updatesToSave.videoTasks) {
          console.log('🚨 SAVING VIDEO TASKS TO API:', {
            sessionId: currentSession.id,
            videoTasksCount: updatesToSave.videoTasks.length,
            videoTasksDetails: updatesToSave.videoTasks.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId }))
          });
        }
        
        console.log('📡 Sending auto-save request for session:', currentSession.id, {
          keysToSave: Object.keys(updatesToSave),
          videoTasksToSave: updatesToSave.videoTasks?.length || 0,
          videoTasksDetails: updatesToSave.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })) || []
        });
        
        await fetch(`/api/sessions/${currentSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatesToSave),
        });
        
        console.log('✅ Auto-save completed');
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, 1000); // Auto-save after 1 second of inactivity
  }, [currentSession]);

  // Update session state and trigger auto-save
  const updateSession = useCallback((updates: Partial<SessionData>) => {
    if (!currentSession) {
      console.log('❌ updateSession called but no currentSession');
      return;
    }

    // Special debug for video tasks
    if (updates.videoTasks) {
      console.log('🚨 VIDEO TASKS UPDATE DETECTED:', {
        sessionId: currentSession.id,
        incomingVideoTasksCount: updates.videoTasks.length,
        incomingVideoTasksDetails: updates.videoTasks.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })),
        currentSessionVideoTasksCount: currentSession.videoTasks?.length || 0
      });
    }

    console.log('🔄 updateSession called:', {
      sessionId: currentSession.id,
      updateKeys: Object.keys(updates),
      addedImagesCount: updates.addedImages?.length,
      videoTasksCount: updates.videoTasks?.length,
      addedImagesDetails: updates.addedImages?.map(img => ({ taskId: img.taskId, filename: img.filename })),
      videoTasksDetails: updates.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId }))
    });
    
    // Immediate local state update for UI responsiveness
    setCurrentSession(prev => {
      if (!prev) return null;
      const newSession = { ...prev, ...updates };
      
      // Special debug for video tasks state update
      if (updates.videoTasks) {
        console.log('🎯 VIDEO TASKS LOCAL STATE UPDATED:', {
          sessionId: newSession.id,
          oldVideoTasksCount: prev.videoTasks?.length || 0,
          newVideoTasksCount: newSession.videoTasks?.length || 0,
          newVideoTasksDetails: newSession.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })) || []
        });
      }
      
      console.log('🎯 Local state updated:', {
        sessionId: newSession.id,
        videoTasksCount: newSession.videoTasks?.length || 0,
        videoTasksStatuses: newSession.videoTasks?.map(task => ({ imageName: task.imageName, status: task.status, taskId: task.taskId })) || []
      });
      return newSession;
    });
    
    // Trigger auto-save
    autoSave(updates);
  }, [currentSession, autoSave]);

  // Initialize with first session or create one
  useEffect(() => {
    const initializeSession = async () => {
      if (!projectId) return;
      
      try {
        // Check if projectId is numeric (product ID) or starts with proj_ (project ID)
        const isProductId = /^\d+$/.test(projectId);
        const endpoint = isProductId ? `/api/products/${projectId}/sessions` : `/api/projects/${projectId}/sessions`;
        
        const headers = isProductId ? getAuthHeaders() : undefined;
        
        // Try to get existing sessions for this project/product
        const response = await fetch(endpoint, headers ? { headers } : {});
        const data = await response.json();
        
        if (data.success && data.sessions.length > 0) {
          // Load the most recent session
          await loadSession(data.sessions[0].id);
        } else {
          // Create first session for this project/product
          await createSession();
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        // Fallback: create a new session
        await createSession();
      }
    };

    initializeSession();
  }, [projectId, loadSession, createSession, getAuthHeaders]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentSession,
    loading,
    loadSession,
    createSession,
    updateSession,
  };
} 