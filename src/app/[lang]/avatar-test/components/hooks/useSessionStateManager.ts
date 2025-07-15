import { useEffect, useCallback, useRef } from 'react';
import { AvatarSessionData } from '@/utils/avatarSessionManager';
import { ExistingImage, GeneratedAvatar, GeneratedVideo, AvatarPrompt, ConversationMessage } from '../types';
import { CombinedRatioResolutionOption } from '@/utils/imageRatioUtils';

export interface UseSessionStateManagerProps {
  avatarSession: AvatarSessionData | null;
  saveCompleteSessionState: (sessionData: AvatarSessionData) => Promise<AvatarSessionData | null>;
  existingImages: ExistingImage[];
  selectedAvatars: (ExistingImage | GeneratedAvatar)[];
  generatedVideos: GeneratedVideo[];
  avatarDescription: string;
  videoText: string;
  activeTab: 'existing' | 'generate';
  avatarPrompts: AvatarPrompt[];
  conversation: ConversationMessage[];
  aspectRatio: string;
  resolution: string;
  selectedCombinedOption: CombinedRatioResolutionOption;
  setExistingImages: (images: ExistingImage[]) => void;
  setSelectedAvatars: (avatars: (ExistingImage | GeneratedAvatar)[]) => void;
  setGeneratedVideos: (videos: GeneratedVideo[]) => void;
  setAvatarDescription: (description: string) => void;
  setVideoText: (text: string) => void;
  setActiveTab: (tab: 'existing' | 'generate') => void;
  setAvatarPrompts: (prompts: AvatarPrompt[]) => void;
  setConversation: (messages: ConversationMessage[]) => void;
  setAspectRatio: (ratio: string) => void;
  setResolution: (resolution: string) => void;
  setSelectedCombinedOption: (option: CombinedRatioResolutionOption) => void;
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

  // Use refs to track the current state values and prevent unnecessary saves
  const currentStateRef = useRef<{
    existingImages: ExistingImage[];
    generatedVideos: GeneratedVideo[];
    avatarPrompts: AvatarPrompt[];
    conversation: ConversationMessage[];
    avatarDescription: string;
    videoText: string;
    activeTab: 'existing' | 'generate';
    aspectRatio: string;
    resolution: string;
    selectedCombinedOption: CombinedRatioResolutionOption;
  } | null>(null);

  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Update the current state ref
      currentStateRef.current = {
        existingImages: avatarSession.existingImages || [],
        generatedVideos: avatarSession.generatedVideos || [],
        avatarPrompts: avatarSession.avatarPrompts || [],
        conversation: avatarSession.conversation || [],
        avatarDescription: avatarSession.avatarDescription || '',
        videoText: avatarSession.videoText || '',
        activeTab: avatarSession.activeTab || 'existing',
        aspectRatio: avatarSession.aspectRatio || '16:9',
        resolution: avatarSession.resolution || '1024x576',
        selectedCombinedOption: avatarSession.selectedCombinedOption || {} as CombinedRatioResolutionOption,
      };
      
      console.log('✅ Session state restored successfully');
    }
  }, [avatarSession?.id]);

  // Check if current state has changed compared to the last saved state
  const hasStateChanged = useCallback(() => {
    if (!currentStateRef.current) return true;
    
    const current = currentStateRef.current;
    return (
      JSON.stringify(current.existingImages) !== JSON.stringify(existingImages) ||
      JSON.stringify(current.generatedVideos) !== JSON.stringify(generatedVideos) ||
      JSON.stringify(current.avatarPrompts) !== JSON.stringify(avatarPrompts) ||
      JSON.stringify(current.conversation) !== JSON.stringify(conversation) ||
      current.avatarDescription !== avatarDescription ||
      current.videoText !== videoText ||
      current.activeTab !== activeTab ||
      current.aspectRatio !== aspectRatio ||
      current.resolution !== resolution ||
      JSON.stringify(current.selectedCombinedOption) !== JSON.stringify(selectedCombinedOption)
    );
  }, [
    existingImages,
    generatedVideos,
    avatarPrompts,
    conversation,
    avatarDescription,
    videoText,
    activeTab,
    aspectRatio,
    resolution,
    selectedCombinedOption
  ]);

  // Check if video generation is complete and no processing is happening
  const isProcessingComplete = useCallback(() => {
    if (!avatarSession) return false;
    
    // Check if there are any pending video generations
    const hasActiveVideoGeneration = generatedVideos.some(video => 
      video.status === 'processing' || video.status === 'submitted'
    );
    
    // Check session processing flags
    const hasSessionProcessing = avatarSession.isGeneratingVideo || 
                                avatarSession.isAddingMotion || 
                                avatarSession.isUploading;
    
    return !hasActiveVideoGeneration && !hasSessionProcessing;
  }, [avatarSession, generatedVideos]);

  // Save current state with improved logic
  const saveCurrentState = useCallback(async () => {
    if (!avatarSession) return;

    // Don't save if processing is complete and no changes detected
    if (isProcessingComplete() && !hasStateChanged()) {
      console.log('⏸️ Skipping save - no changes detected and processing complete');
      return;
    }

    // Don't save too frequently
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 5000) { // Minimum 5 seconds between saves
      console.log('⏸️ Skipping save - too frequent');
      return;
    }

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
      
      // Update refs
      lastSaveTimeRef.current = now;
      currentStateRef.current = {
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
      };
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
    saveCompleteSessionState,
    isProcessingComplete,
    hasStateChanged
  ]);

  // Improved auto-save mechanism
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Don't set up auto-save if processing is complete and no changes
    if (isProcessingComplete() && !hasStateChanged()) {
      console.log('⏸️ Auto-save paused - processing complete and no changes');
      return;
    }

    // Set up debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentState();
    }, 3000); // Save 3 seconds after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveCurrentState, isProcessingComplete, hasStateChanged]);

  // Manual save function for immediate saves
  const saveImmediately = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveCurrentState();
  }, [saveCurrentState]);

  return {
    saveCurrentState: saveImmediately,
  };
}; 