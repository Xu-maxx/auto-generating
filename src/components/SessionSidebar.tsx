'use client';

import { useState, useEffect, useRef } from 'react';
import { SessionMetadata } from '@/types/session';

interface SessionSidebarProps {
  projectId: string;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  dict: any; // Dictionary for translations
}

export default function SessionSidebar({
  projectId,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  isCollapsed,
  onToggleCollapse,
  dict,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) {
      loadSessions();
    }
  }, [projectId]);

  // Handle scroll events for the rolling logic
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setScrollPosition(scrollTop);
        setShowScrollTop(scrollTop > 200);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const loadSessions = async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`);
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!projectId) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled' }),
      });
      const data = await response.json();
      if (data.success) {
        await loadSessions();
        onSessionSelect(data.session.id);
        onNewSession();
        // Scroll to top to show the new session
        scrollToTop();
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(dict.sessionSidebar.deleteConfirm)) return;
    
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      await loadSessions();
      if (currentSessionId === sessionId) {
        // Create a new session if we deleted the current one
        handleCreateSession();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleRenameSession = async (sessionId: string, newName: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      await loadSessions();
      setEditingSessionId(null);
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  const startEditing = (session: SessionMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  const confirmRename = (sessionId: string) => {
    if (editingName.trim()) {
      handleRenameSession(sessionId, editingName.trim());
    } else {
      cancelEditing();
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return dict.sessionSidebar.dateFormats.yesterday;
    } else if (diffDays < 7) {
      return dict.sessionSidebar.dateFormats.daysAgo.replace('{count}', diffDays.toString());
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Group sessions by date for better organization
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.updatedAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey = '';
    if (date.toDateString() === today.toDateString()) {
      groupKey = dict.sessionSidebar.timeGroups.today;
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = dict.sessionSidebar.timeGroups.yesterday;
    } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
      groupKey = dict.sessionSidebar.timeGroups.thisWeek;
    } else {
      groupKey = dict.sessionSidebar.timeGroups.older;
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(session);
    return groups;
  }, {} as Record<string, SessionMetadata[]>);

  if (loading) {
    return (
      <div className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 flex flex-col ${
      isCollapsed ? 'w-12' : 'w-80'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-gray-800">{dict.sessionSidebar.title}</h2>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCreateSession}
              className={`p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors ${
                isCollapsed ? 'w-8 h-8' : 'px-3 py-2'
              }`}
              title={dict.sessionSidebar.createSession}
            >
              {isCollapsed ? '+' : `+ ${dict.sessionSidebar.newSession}`}
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
              title={isCollapsed ? dict.sessionSidebar.expandSidebar : dict.sessionSidebar.collapseSidebar}
            >
              {isCollapsed ? '→' : '←'}
            </button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-2 py-4 space-y-4"
        >
          {sessions.length === 0 ? (
            <div className={`text-center text-gray-500 ${isCollapsed ? 'hidden' : ''}`}>
              <p className="text-sm">{dict.sessionSidebar.noSessions}</p>
              <button
                onClick={handleCreateSession}
                className="text-blue-600 hover:text-blue-800 text-sm underline mt-2"
              >
                {dict.sessionSidebar.createFirstSession}
              </button>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([groupName, groupSessions]) => (
              <div key={groupName}>
                {!isCollapsed && (
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">
                    {groupName}
                  </h3>
                )}
                <div className="space-y-1">
                  {groupSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => onSessionSelect(session.id)}
                      className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        currentSessionId === session.id
                          ? 'bg-blue-100 border-blue-300 border'
                          : 'bg-white hover:bg-gray-100 border border-gray-200'
                      } ${isCollapsed ? 'p-2' : ''}`}
                    >
                      {editingSessionId === session.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => confirmRename(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename(session.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="w-full text-sm font-medium bg-white border border-blue-500 rounded px-2 py-1 focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className={`${isCollapsed ? 'text-center' : ''}`}>
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium text-gray-900 truncate ${
                              isCollapsed ? 'text-xs' : 'text-sm'
                            }`}>
                              {isCollapsed ? session.name.slice(0, 2).toUpperCase() : session.name}
                            </h4>
                            {!isCollapsed && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button
                                  onClick={(e) => startEditing(session, e)}
                                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  title={dict.sessionSidebar.renameSession}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  title={dict.sessionSidebar.deleteSession}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                          {!isCollapsed && (
                            <div className="mt-1 text-xs text-gray-500 space-y-1">
                              <div className="flex justify-between">
                                <span>{formatDate(session.updatedAt)}</span>
                                <span>{dict.sessionSidebar.itemsCount.replace('{count}', (session.imageCount + session.videoCount).toString())}</span>
                              </div>
                              {session.imageCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">🖼️ {session.imageCount}</span>
                                  {session.videoCount > 0 && (
                                    <span className="text-purple-600">🎬 {session.videoCount}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Scroll controls */}
        {!isCollapsed && showScrollTop && (
          <button
            onClick={scrollToTop}
            className="absolute top-4 right-4 p-2 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all text-gray-600 hover:text-gray-900"
            title={dict.sessionSidebar.scrollToTop}
          >
            ↑
          </button>
        )}
        
        {!isCollapsed && sessions.length > 5 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md transition-all text-gray-600 hover:text-gray-900"
            title={dict.sessionSidebar.scrollToBottom}
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
} 