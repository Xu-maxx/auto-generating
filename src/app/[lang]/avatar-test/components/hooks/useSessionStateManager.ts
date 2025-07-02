import { useEffect, useCallback } from 'react';
import { AvatarSessionData } from '@/utils/avatarSessionManager';
import { 
  GeneratedAvatar, 
  ExistingImage, 
  AvatarPrompt, 
  ConversationMessage, 
  GeneratedVideo 
} from '../types';

interface UseSessionStateManagerProps {
  avatarSession: AvatarSessionData | null;
  saveCompleteSessionState: (sessionData: AvatarSessionData) => Promise<AvatarSessionData | null>;
  
  // All the state that needs to be saved/restored
  existingImages: ExistingImage[];
  selectedAvatars: any[];
  generatedVideos: GeneratedVideo[];
  avatarDescription: string;
  videoText: string;
  activeTab: 'existing' | 'generate';
  avatarPrompts: AvatarPrompt[];
  conversation: ConversationMessage[];
  aspectRatio: string;
  resolution: string;
  selectedCombinedOption: string;
  
  // Setters for state restoration
  setExistingImages: (images: ExistingImage[]) => void;
  setSelectedAvatars: (avatars: any[]) => void;
  setGeneratedVideos: (videos: GeneratedVideo[]) => void;
  setAvatarDescription: (desc: string) => void;
  setVideoText: (text: string) => void;
  setActiveTab: (tab: 'existing' | 'generate') => void;
  setAvatarPrompts: (prompts: AvatarPrompt[]) => void;
  setConversation: (conv: ConversationMessage[]) => void;
  setAspectRatio: (ratio: string) => void;
  setResolution: (res: string) => void;
  setSelectedCombinedOption: (option: string) => void;
}

export const useSessionStateManager = ({
  avatarSession,
  saveCompleteSessionState,
  existingImages,
  selectedAvatars,
  generatedVideos,
  avatarDescription,
  videoText,
  activeTab,
  avatarPrompts,
  conversation,
  aspectRatio,
  resolution,
  selectedCombinedOption,
  setExistingImages,
  setSelectedAvatars,
  setGeneratedVideos,
  setAvatarDescription,
  setVideoText,
  setActiveTab,
  setAvatarPrompts,
  setConversation,
  setAspectRatio,
  setResolution,
  setSelectedCombinedOption,
}: UseSessionStateManagerProps) => {

  // Restore session state when session changes
  useEffect(() => {
    if (avatarSession) {
      console.log('🔄 Restoring session state for:', avatarSession.id);
      
      // Restore generated content
      if (avatarSession.existingImages) {
        setExistingImages(avatarSession.existingImages);
      }
      if (avatarSession.generatedVideos) {
        setGeneratedVideos(avatarSession.generatedVideos);
      }
      
      // Restore AI interaction data
      if (avatarSession.avatarPrompts) {
        setAvatarPrompts(avatarSession.avatarPrompts);
      }
      if (avatarSession.conversation) {
        setConversation(avatarSession.conversation);
      }
      
      // Restore form state
      if (avatarSession.avatarDescription) {
        setAvatarDescription(avatarSession.avatarDescription);
      }
      if (avatarSession.videoText) {
        setVideoText(avatarSession.videoText);
      }
      if (avatarSession.activeTab) {
        setActiveTab(avatarSession.activeTab);
      }
      if (avatarSession.aspectRatio) {
        setAspectRatio(avatarSession.aspectRatio);
      }
      if (avatarSession.resolution) {
        setResolution(avatarSession.resolution);
      }
      if (avatarSession.selectedCombinedOption) {
        setSelectedCombinedOption(avatarSession.selectedCombinedOption);
      }
      
      console.log('✅ Session state restored successfully');
    }
  }, [avatarSession?.id]); // Only trigger when session ID changes

  // Save session state periodically and on important changes
  const saveCurrentState = useCallback(async () => {
    if (!avatarSession) return;

    const updatedSessionData: AvatarSessionData = {
      ...avatarSession,
      
      // Generated content
      existingImages,
      generatedVideos,
      generatedAvatars: [], // Will be populated by component
      
      // AI interaction data
      avatarPrompts,
      conversation,
      
      // Form state
      avatarDescription,
      videoText,
      activeTab,
      aspectRatio,
      resolution,
      selectedCombinedOption,
      
      // Update timestamp
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveCompleteSessionState(updatedSessionData);
      console.log('💾 Session state saved successfully');
    } catch (error) {
      console.error('❌ Error saving session state:', error);
    }
  }, [
    avatarSession,
    existingImages,
    generatedVideos,
    avatarPrompts,
    conversation,
    avatarDescription,
    videoText,
    activeTab,
    aspectRatio,
    resolution,
    selectedCombinedOption,
    saveCompleteSessionState
  ]);

  // Auto-save on state changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveCurrentState();
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [saveCurrentState]);

  return {
    saveCurrentState,
  };
}; 