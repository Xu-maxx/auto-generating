'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AvatarSessionManager, AvatarSessionData, AvatarAsset, AvatarGroup } from '@/utils/avatarSessionManager';
import { COMBINED_RATIO_RESOLUTION_OPTIONS } from '@/utils/imageRatioUtils';

// Import the new sidebar component
import AvatarSessionSidebar from '@/components/AvatarSessionSidebar';

// Import types from components
import { 
  AvatarTestClientProps,
  GeneratedAvatar,
  ExistingImage,
  AvatarPrompt,
  ConversationMessage,
  GeneratedVideo
} from './components/types';

// Import components
import GenerateAvatarTab from './components/GenerateAvatarTab';
import GeneratedVideosDisplay from './components/GeneratedVideosDisplay';
import VideoGenerationPanel from './components/VideoGenerationPanel';
import SelectedAvatarsPanel from './components/SelectedAvatarsPanel';
import GeneratedAvatarsGrid from './components/GeneratedAvatarsGrid';
import AvatarPromptSection from './components/AvatarPromptSection';
import ExistingImagesTab from './components/ExistingImagesTab';
import NotificationPanel from './components/NotificationPanel';
import SessionInfoPanel from './components/SessionInfoPanel';

// Import custom hooks
import { 
  useAvatarSession,
  useImageManagement,
  useAvatarPrompts,
  useVideoGeneration
} from './components/hooks';

export default function AvatarTestClient({ dict, searchParams }: AvatarTestClientProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for immediate UI updates (debounced session save)
  const [localVideoText, setLocalVideoText] = useState<string>('');

  // Ref to track restored sessions to prevent loops
  const restoredSessionsRef = useRef<Set<string>>(new Set());

  // Extract product information from searchParams
  const productId = searchParams?.productId as string;
  const productName = searchParams?.productName as string;

  // Initialize router for navigation
  const router = useRouter();

  // Use custom hooks
  const { 
    avatarSession, 
    setAvatarSession, 
    currentSessionId, 
    loadSession, 
    createNewSession,
    saveCompleteSessionState
  } = useAvatarSession(productId);
  
  // Session-based state getters
  const sessionExistingImages = avatarSession?.existingImages || [];
  const sessionSelectedAvatars = avatarSession?.selectedAvatars || [];
  const generatedVideos = avatarSession?.generatedVideos || [];
  const avatarDescription = avatarSession?.avatarDescription || '';
  const videoText = avatarSession?.videoText || '';
  const activeTab = avatarSession?.activeTab || 'existing';
  const avatarPrompts = avatarSession?.avatarPrompts || [];
  const conversation = avatarSession?.conversation || [];
  const aspectRatio = avatarSession?.aspectRatio || '16:9';
  const resolution = avatarSession?.resolution || '1024x576';
  const selectedCombinedOption = avatarSession?.selectedCombinedOption || COMBINED_RATIO_RESOLUTION_OPTIONS.find(opt => opt.id === '16:9-1024x576') || COMBINED_RATIO_RESOLUTION_OPTIONS[0];

  // Sync local video text with session when session changes
  useEffect(() => {
    setLocalVideoText(videoText);
  }, [videoText]);

  const {
    isGeneratingVideo,
    videoGenerationStatus,
    forceRender,
    isAddingMotion,
    motionStatus,
    isUploading,
    uploadStatus,
    statusCheckIntervals,
    setIsGeneratingVideo,
    setVideoGenerationStatus,
    setForceRender,
    setIsAddingMotion,
    setMotionStatus,
    setIsUploading,
    setUploadStatus,
    setStatusCheckIntervals,
    checkVideoStatus,
    startVideoStatusInterval,
    clearVideoStatusInterval,
    addVideoStatusInterval,
    clearAllVideoStatusIntervals,
    waitForAvatarsCompletion
  } = useVideoGeneration();

  // Session state updaters
  const updateAvatarSession = useCallback(async (updates: Partial<AvatarSessionData>) => {
    setAvatarSession(prevSession => {
      if (!prevSession) return prevSession;
      
      const updatedSession = { ...prevSession, ...updates, updatedAt: new Date().toISOString() };
      
      // Save to backend asynchronously without blocking the UI
      saveCompleteSessionState(updatedSession).catch(error => {
        console.error('Failed to save session updates:', error);
      });
      
      return updatedSession;
    });
  }, [saveCompleteSessionState]);

  // Save processing states to session (NEW: to preserve ongoing operations)
  const saveProcessingStates = useCallback(async () => {
    if (!avatarSession) return;
    
    const processingStates = {
      isGeneratingVideo,
      videoGenerationStatus,
      isAddingMotion,
      motionStatus,
      isUploading,
      uploadStatus,
      lastProcessingUpdate: new Date().toISOString()
    };
    
    // Only save if there are actual processing states to preserve
    if (isGeneratingVideo || isAddingMotion || isUploading || 
        videoGenerationStatus || motionStatus || uploadStatus) {
      console.log('💾 Saving processing states to session:', processingStates);
      await updateAvatarSession(processingStates);
    }
  }, [avatarSession, isGeneratingVideo, videoGenerationStatus, isAddingMotion, 
      motionStatus, isUploading, uploadStatus, updateAvatarSession]);

  // Auto-save processing states when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveProcessingStates();
    }, 1000); // Save 1 second after processing state changes

    return () => clearTimeout(timeoutId);
  }, [saveProcessingStates]);

  // Restore processing states when session is loaded (NEW)
  useEffect(() => {
    if (avatarSession && avatarSession.id) {
      console.log('🔄 Restoring processing states for session:', avatarSession.id);
      
      // Restore processing states if they exist in session data
      if (avatarSession.isGeneratingVideo) {
        setIsGeneratingVideo(true);
        console.log('✅ Restored isGeneratingVideo:', true);
      }
      if (avatarSession.videoGenerationStatus) {
        setVideoGenerationStatus(avatarSession.videoGenerationStatus);
        console.log('✅ Restored videoGenerationStatus:', avatarSession.videoGenerationStatus);
      }
      if (avatarSession.isAddingMotion) {
        setIsAddingMotion(true);
        console.log('✅ Restored isAddingMotion:', true);
      }
      if (avatarSession.motionStatus) {
        setMotionStatus(avatarSession.motionStatus);
        console.log('✅ Restored motionStatus:', avatarSession.motionStatus);
      }
      if (avatarSession.isUploading) {
        setIsUploading(true);
        console.log('✅ Restored isUploading:', true);
      }
      if (avatarSession.uploadStatus) {
        setUploadStatus(avatarSession.uploadStatus);
        console.log('✅ Restored uploadStatus:', avatarSession.uploadStatus);
      }
      
      // Check if processing states are stale (older than 5 minutes)
      if (avatarSession.lastProcessingUpdate) {
        const lastUpdate = new Date(avatarSession.lastProcessingUpdate);
        const now = new Date();
        const timeDiff = now.getTime() - lastUpdate.getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeDiff > fiveMinutes) {
          console.log('⚠️ Processing states are stale, clearing them');
          setIsGeneratingVideo(false);
          setVideoGenerationStatus('');
          setIsAddingMotion(false);
          setMotionStatus('');
          setIsUploading(false);
          setUploadStatus('');
          
          // Clear stale states from session
          updateAvatarSession({
            isGeneratingVideo: false,
            videoGenerationStatus: '',
            isAddingMotion: false,
            motionStatus: '',
            isUploading: false,
            uploadStatus: '',
            lastProcessingUpdate: ''
          });
        }
      }
    }
  }, [avatarSession?.id, setIsGeneratingVideo, setVideoGenerationStatus, 
      setIsAddingMotion, setMotionStatus, setIsUploading, setUploadStatus, updateAvatarSession]);

  // Debounced video text saving (5 seconds)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localVideoText !== videoText) {
        console.log('💾 Debounced save: Video text updated in session');
        updateAvatarSession({ videoText: localVideoText });
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [localVideoText, videoText, updateAvatarSession]);

  // Callback to sync selected avatars to session
  const onSelectedAvatarsChange = useCallback((avatars: (ExistingImage | GeneratedAvatar)[]) => {
    console.log('💾 Saving selected avatars to session:', avatars.length);
    updateAvatarSession({ selectedAvatars: avatars });
  }, [updateAvatarSession]);

  // Session-aware prompt generation functions
  const handleRatioResolutionChange = useCallback((newAspectRatio: string, newResolution: {width: number, height: number}) => {
    console.log('🔄 Avatar generation ratio/resolution change:', { newAspectRatio, newResolution });
    
    // Update the selected combined option
    const newOption = COMBINED_RATIO_RESOLUTION_OPTIONS.find(
      option => option.aspectRatio === newAspectRatio && 
                option.width === newResolution.width && 
                option.height === newResolution.height
    );
    
    if (newOption) {
      updateAvatarSession({ 
        aspectRatio: newAspectRatio,
        resolution: `${newResolution.width}x${newResolution.height}`,
        selectedCombinedOption: newOption
      });
    }
  }, [updateAvatarSession]);

  const generatePrompt = useCallback(async () => {
    if (!avatarDescription.trim()) {
      setError('Please enter an avatar description');
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      console.log('🤖 Generating prompt for:', avatarDescription);
      const response = await fetch('/api/optimize-avatar-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: avatarDescription,
          messages: conversation
        }),
      });

      const data = await response.json();
      console.log('🤖 Prompt generation response:', data);

      if (data.success) {
        const newPrompt: AvatarPrompt = {
          id: Date.now(),
          content: avatarDescription,
          runwayPrompt: data.optimizedPrompt,
          chineseTranslation: data.chineseTranslation || '',
          isEdited: false,
          generatedImages: [],
          isGeneratingImages: false,
          failedCount: 0
        };

        // Update session with new prompt and conversation
        const newConversation: ConversationMessage[] = [
          ...conversation,
          { role: 'user' as const, content: avatarDescription },
          { role: 'assistant' as const, content: data.optimizedPrompt }
        ];

        updateAvatarSession({ 
          avatarPrompts: [...avatarPrompts, newPrompt],
          conversation: newConversation
        });

        console.log('✅ Prompt generated successfully!');
      } else {
        console.error('❌ Prompt generation failed:', data.error);
        setError(data.error || 'Failed to optimize prompt');
      }
    } catch (error) {
      console.error('❌ Error optimizing prompt:', error);
      setError('Network error occurred');
    } finally {
      setIsOptimizing(false);
    }
  }, [avatarDescription, conversation, avatarPrompts, updateAvatarSession]);

  const handlePromptEdit = useCallback((id: number, newRunwayPrompt: string) => {
    const updatedPrompts = avatarPrompts.map(prompt => 
      prompt.id === id 
        ? { ...prompt, runwayPrompt: newRunwayPrompt, isEdited: true }
        : prompt
    );
    updateAvatarSession({ avatarPrompts: updatedPrompts });
  }, [avatarPrompts, updateAvatarSession]);

  const generateAvatars = useCallback(async (promptId: number, imageCount: number) => {
    const prompt = avatarPrompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Set generating state for this specific prompt
    const updatedPrompts = avatarPrompts.map(p => 
      p.id === promptId 
        ? { ...p, isGeneratingImages: true }
        : p
    );
    updateAvatarSession({ avatarPrompts: updatedPrompts });

    try {
      // Convert string resolution to object format that the API expects
      const resolutionObj = (() => {
        if (typeof resolution === 'string') {
          const [width, height] = resolution.split('x').map(Number);
          return { width, height };
        }
        return resolution;
      })();

      console.log('🖼️ Generating avatars:', { promptId, imageCount, aspectRatio, resolution: resolutionObj });
      const response = await fetch('/api/runway-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptText: prompt.runwayPrompt,
          imageCount: imageCount,
          aspectRatio: aspectRatio,
          resolution: resolutionObj
        }),
      });

      const data = await response.json();
      console.log('🖼️ Runway API Response:', data);

      if (data.success) {
        if (data.images && data.images.length > 0) {
          // Generation successful - update prompt with new images
          const newGeneratedImages: GeneratedAvatar[] = data.images.map((imageData: any, index: number) => ({
            id: `${imageData.taskId}_${index}`,
            filename: imageData.filename,
            url: imageData.url,
            prompt: imageData.prompt,
            taskId: imageData.taskId
          }));

          console.log('✅ Generated avatars:', newGeneratedImages.length);
          
          const finalUpdatedPrompts = avatarPrompts.map(p => 
            p.id === promptId 
              ? { 
                  ...p, 
                  isGeneratingImages: false, 
                  generatedImages: [...p.generatedImages, ...newGeneratedImages]
                }
              : p
          );
          updateAvatarSession({ avatarPrompts: finalUpdatedPrompts });

          // Show warning if not all images were generated
          if (data.images.length < imageCount) {
            setError(`Partially successful: ${data.images.length}/${imageCount} images generated`);
          }
        } else {
          // API succeeded but no images returned (likely timeout)
          console.log('⚠️ API succeeded but no images returned - likely timeout');
          const failedPrompts = avatarPrompts.map(p => 
            p.id === promptId 
              ? { 
                  ...p, 
                  isGeneratingImages: false,
                  failedCount: p.failedCount + 1
                }
              : p
          );
          updateAvatarSession({ avatarPrompts: failedPrompts });
          setError('Generation timed out - no images were completed within the time limit');
        }
      } else {
        // API returned success: false
        console.log('❌ API returned success: false:', data.error);
        const failedPrompts = avatarPrompts.map(p => 
          p.id === promptId 
            ? { 
                ...p, 
                isGeneratingImages: false,
                failedCount: p.failedCount + 1
              }
            : p
        );
        updateAvatarSession({ avatarPrompts: failedPrompts });
        setError(data.error || 'Failed to generate avatars');
      }
    } catch (error) {
      console.error('❌ Error generating avatars:', error);
      const failedPrompts = avatarPrompts.map(p => 
        p.id === promptId 
          ? { 
              ...p, 
              isGeneratingImages: false,
              failedCount: p.failedCount + 1
            }
          : p
      );
      updateAvatarSession({ avatarPrompts: failedPrompts });
      setError('Network error occurred during generation');
    }
  }, [avatarPrompts, aspectRatio, resolution, updateAvatarSession]);

  const {
    existingImages,
    selectedAvatars,
    loading,
    loadExistingImages,
    handleFileUpload,
    selectExistingImage,
    selectGeneratedAvatar,
    selectAllImages,
    clearSelection,
    selectAllGeneratedAvatars,
    removeSelectedAvatar
  } = useImageManagement({
    sessionSelectedAvatars,
    onSelectedAvatarsChange
  });

  // Load existing images on component mount
  useEffect(() => {
    loadExistingImages();
  }, []);

  // Debug: Log when session selected avatars change
  useEffect(() => {
    console.log('🔄 Session selected avatars changed:', sessionSelectedAvatars.length);
  }, [sessionSelectedAvatars]);

  // Debug: Log when generated videos change to track video URL updates
  useEffect(() => {
    console.log('🎬 Generated videos in session changed:', generatedVideos.length);
    generatedVideos.forEach(video => {
      console.log(`   Video ${video.videoId}: status=${video.status}, hasUrl=${!!video.videoUrl}`);
    });
  }, [generatedVideos]);

  // Custom video status checking that updates session state
  const checkVideoStatusAndUpdateSession = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/heygen-video-status?videoId=${videoId}`);
      const data = await response.json();
      
      console.log(`🎬 Video status check for ${videoId}:`, data);
      
      if (data.success || (data.code === 100 && data.data)) {
        // Extract the actual video data - handle different API response structures
        const videoData = data.data || data;
        const videoStatus = videoData.status;
        const videoUrl = videoData.video_url || videoData.videoUrl;
        const thumbnailUrl = videoData.thumbnail_url || videoData.thumbnailUrl;
        const duration = videoData.duration;
        
        console.log(`📊 Extracted video data for ${videoId}:`, {
          status: videoStatus,
          hasVideoUrl: !!videoUrl,
          hasThumbnailUrl: !!thumbnailUrl,
          duration: duration
        });
        
        // Get current session data directly to avoid dependency loops
        setAvatarSession(currentSession => {
          if (!currentSession) return currentSession;
          
          const currentVideos = currentSession.generatedVideos || [];
          const updatedVideos = currentVideos.map(video => {
            if (video.videoId === videoId) {
              const updatedVideo = {
                ...video,
                status: videoStatus,
                videoUrl: videoUrl || video.videoUrl,
                thumbnailUrl: thumbnailUrl || video.thumbnailUrl,
                duration: duration || video.duration,
                videoData: videoData || video.videoData
              };
              
              console.log(`🔄 Updated video ${videoId}:`, updatedVideo);
              return updatedVideo;
            }
            return video;
          });
          
          // Check if all videos in this session are completed or failed
          const allVideosFinished = updatedVideos.every(video => 
            video.status === 'completed' || video.status === 'failed'
          );
          
          // Clear processing states if all videos are finished
          const processingStateUpdates = allVideosFinished ? {
            isGeneratingVideo: false,
            videoGenerationStatus: '',
            lastProcessingUpdate: new Date().toISOString()
          } : {};
          
          const updatedSession = { 
            ...currentSession, 
            generatedVideos: updatedVideos,
            ...processingStateUpdates,
            updatedAt: new Date().toISOString() 
          };
          
          // Save to backend asynchronously
          saveCompleteSessionState(updatedSession).catch(error => {
            console.error('Failed to save session updates:', error);
          });
          
          return updatedSession;
        });
        
        // Stop polling if video is completed or failed
        if (videoStatus === 'completed' || videoStatus === 'failed') {
          console.log(`🛑 Video ${videoId} ${videoStatus}, stopping polling...`);
          clearVideoStatusInterval(videoId);
          
          if (videoStatus === 'completed' && videoUrl) {
            console.log(`✅ Video generation completed successfully for ${videoId}!`);
            setSuccessNotification(`✅ Video completed: ${videoId}`);
            
            // Check if this was the last video being processed
            const currentVideos = generatedVideos || [];
            const processingVideos = currentVideos.filter(v => v.status === 'processing');
            if (processingVideos.length <= 1) { // <= 1 because this video is about to be marked as completed
              console.log('🎉 All videos completed! Clearing processing states...');
              setIsGeneratingVideo(false);
              setVideoGenerationStatus('');
            }
          } else if (videoStatus === 'failed') {
            console.log(`❌ Video generation failed for ${videoId}`);
            setError(`Video generation failed for ${videoId}`);
            
            // Also clear processing states if this was the last video
            const currentVideos = generatedVideos || [];
            const processingVideos = currentVideos.filter(v => v.status === 'processing');
            if (processingVideos.length <= 1) {
              console.log('⚠️ No more videos processing, clearing processing states...');
              setIsGeneratingVideo(false);
              setVideoGenerationStatus('');
            }
          }
        } else {
          console.log(`⏳ Video ${videoId} status: ${videoStatus} - continuing to poll...`);
        }
      } else {
        console.error('Failed to check video status:', data.error);
      }
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }, [setAvatarSession, saveCompleteSessionState, clearVideoStatusInterval, generatedVideos, 
      setIsGeneratingVideo, setVideoGenerationStatus]);

  // Custom video status interval management
  const startVideoStatusIntervalWithSessionUpdate = useCallback((videoId: string) => {
    console.log(`🚀 Starting video status polling for ${videoId}`);
    
    const interval = setInterval(() => {
      checkVideoStatusAndUpdateSession(videoId);
    }, 5000); // Check every 5 seconds
    
    // Store the interval using the hook's management
    addVideoStatusInterval(videoId, interval);
  }, [checkVideoStatusAndUpdateSession, addVideoStatusInterval]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      clearAllVideoStatusIntervals();
    };
  }, [clearAllVideoStatusIntervals]); // Now safe since functions are properly memoized

  // Handle video restoration when sessions are loaded
  useEffect(() => {
    if (avatarSession && generatedVideos.length > 0 && !restoredSessionsRef.current.has(avatarSession.id)) {
      console.log('🔄 Restoring video status monitoring for session:', avatarSession.id);
      
      // Mark this session as restored
      restoredSessionsRef.current.add(avatarSession.id);
      
      generatedVideos.forEach(video => {
        if (video.status === 'processing' && video.videoId) {
          console.log(`🚀 Restarting video status monitoring for processing video: ${video.videoId}`);
          // Create interval manually to use session-updating function
          const interval = setInterval(() => {
            checkVideoStatusAndUpdateSession(video.videoId);
          }, 5000);
          addVideoStatusInterval(video.videoId, interval);
        } else if (video.status === 'completed' && video.videoUrl) {
          console.log(`✅ Video already completed: ${video.videoId} - ${video.videoUrl.substring(0, 50)}...`);
        }
      });
    } else if (avatarSession && restoredSessionsRef.current.has(avatarSession.id)) {
      console.log('⏭️ Session already restored, skipping:', avatarSession.id);
    }
  }, [avatarSession?.id, checkVideoStatusAndUpdateSession, addVideoStatusInterval]); // Added dependencies

  // Reset states when switching sessions (selections will sync from session data automatically)
  useEffect(() => {
    if (currentSessionId) {
      console.log('🔄 Switching to session:', currentSessionId);
      
      // Only reset UI states and errors when switching sessions
      // Processing states will be restored by the restoration logic
      setError(null);
      setSuccessNotification('');
      
      // Clear restored sessions tracking when switching sessions
      restoredSessionsRef.current.clear();
      
      console.log('✅ Session switching cleanup completed');
    }
  }, [currentSessionId]);

  // Clear processing states only when explicitly needed (not during session switches)
  const clearProcessingStates = useCallback(() => {
    setIsUploading(false);
    setIsAddingMotion(false);
    setIsGeneratingVideo(false);
    setUploadStatus('');
    setMotionStatus('');
    setVideoGenerationStatus('');
    
    // Also clear from session data
    if (avatarSession) {
      updateAvatarSession({
        isGeneratingVideo: false,
        videoGenerationStatus: '',
        isAddingMotion: false,
        motionStatus: '',
        isUploading: false,
        uploadStatus: '',
        lastProcessingUpdate: ''
      });
    }
    
    console.log('🔄 Processing states cleared');
  }, [avatarSession, updateAvatarSession, setIsUploading, setIsAddingMotion, 
      setIsGeneratingVideo, setUploadStatus, setMotionStatus, setVideoGenerationStatus]);

  // Manual reset function for debugging stuck states
  const resetAllStates = () => {
    clearProcessingStates();
    clearAllVideoStatusIntervals();
    setError(null);
    setSuccessNotification('');
    console.log('🔄 All states have been reset');
  };

  // Session management handlers
  const handleSessionSelect = async (sessionId: string) => {
    console.log('🔄 Loading session:', sessionId);
    const loadedSession = await loadSession(sessionId);
    if (loadedSession?.generatedVideos?.length > 0) {
      console.log('📹 Session has videos:', loadedSession.generatedVideos.length);
      loadedSession.generatedVideos.forEach((video: GeneratedVideo) => {
        console.log(`   Video ${video.videoId}: status=${video.status}, hasUrl=${!!video.videoUrl}`);
      });
    }
  };

  const handleNewSession = async () => {
    await createNewSession();
  };

  const generateCompleteVideo = async () => {
    if (selectedAvatars.length === 0) {
      setError('Please select at least one avatar');
      return;
    }

    if (!localVideoText.trim()) {
      setError('Please enter text for the video');
      return;
    }

    // Force save current video text before generation
    if (localVideoText !== videoText) {
      console.log('💾 Force save: Video text updated before generation');
      updateAvatarSession({ videoText: localVideoText });
    }

    try {
      // Step 0: Generate Audio with Voice Selection
      setUploadStatus('Step 1/4: Selecting voice and generating audio...');
      setError(null);
      
      let selectedVoice = '';
      let generatedAudioUrl = '';
      let audioInfo = { duration: '', reqid: '', voice: '' };
      
      try {
        console.log('🎤 Step 1: Selecting voice...');
        
        const requestData: { avatarDescription?: string; imageUrls?: string[] } = {};

        // Add avatar description if available
        if (avatarDescription && avatarDescription.trim()) {
          requestData.avatarDescription = avatarDescription.trim();
        }

        // Add generated avatar images if available
        const validImageUrls: string[] = [];
        if (selectedAvatars && selectedAvatars.length > 0) {
          console.log('🖼️ Processing avatar images for voice selection...');
          
          for (const avatar of selectedAvatars) {
            if (avatar.url) {
              try {
                let imageUrl = avatar.url;
                
                // Check if it's a local relative URL that needs to be converted to base64
                if (imageUrl.startsWith('/')) {
                  console.log('📸 Converting local image to base64:', imageUrl);
                  
                  // Fetch the local image and convert to base64
                  const response = await fetch(imageUrl);
                  if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.readAsDataURL(blob);
                    });
                    
                    validImageUrls.push(base64);
                    console.log('✅ Successfully converted to base64:', imageUrl);
                  } else {
                    console.warn('⚠️ Failed to fetch local image:', imageUrl, response.status);
                  }
                } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                  // External URLs can be used directly
                  validImageUrls.push(imageUrl);
                  console.log('📸 Adding external image URL:', imageUrl);
                } else {
                  console.warn('⚠️ Skipping invalid image URL:', avatar.url);
                }
              } catch (error) {
                console.error('❌ Error processing image:', avatar.url, error);
              }
            }
          }
        }

        if (validImageUrls.length > 0) {
          requestData.imageUrls = validImageUrls;
          console.log(`🖼️ Will send ${validImageUrls.length} image(s) to OpenAI for voice selection`);
        }

        // Fallback: if no description and no valid URLs, try to create description from filename
        if (!requestData.avatarDescription && validImageUrls.length === 0 && selectedAvatars.length > 0) {
          const firstAvatar = selectedAvatars[0];
          if (firstAvatar.filename) {
            requestData.avatarDescription = `Avatar image: ${firstAvatar.filename}`;
          }
        }

        if (!requestData.avatarDescription && (!requestData.imageUrls || requestData.imageUrls.length === 0)) {
          throw new Error('No avatar description or images available for voice selection. Please generate avatar prompts first, or ensure selected images are accessible via full URLs.');
        }

        console.log('🎤 Voice selection request:', {
          hasDescription: !!requestData.avatarDescription,
          imageCount: requestData.imageUrls?.length || 0,
          description: requestData.avatarDescription?.substring(0, 50) + '...',
          imageTypes: requestData.imageUrls?.map(url => 
            url.startsWith('data:') ? 'base64_data' : url.substring(url.lastIndexOf('/') + 1)
          ) || []
        });

        const voiceResponse = await fetch('/api/select-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        if (!voiceResponse.ok) {
          const errorData = await voiceResponse.json();
          throw new Error(errorData.error || 'Failed to select voice');
        }

        const voiceData = await voiceResponse.json();
        selectedVoice = voiceData.selectedVoice;
        
        console.log('✅ Step 1 Complete - OpenAI selected voice:', selectedVoice);
        console.log('📝 Reasoning:', voiceData.reasoning);
        
        if (voiceData.fallbackUsed || voiceData.fallback) {
          console.warn('⚠️ Fallback voice used.');
          console.log('📝 Fallback reason:', voiceData.error || 'Voice selection fallback');
        }

        // Step 2: Generate Audio with Selected Voice
        setUploadStatus('Step 1/4: Generating audio with selected voice...');
        console.log('🎵 Step 1.2: Starting audio generation with selected voice...');
        console.log('🗣️ Voice:', selectedVoice);
        console.log('📝 Text:', localVideoText);

        const audioResponse = await fetch('/api/volcengine-generate-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: localVideoText,
            voiceName: selectedVoice,
            speed: 1.0,
            volume: 1.0
          }),
        });

        if (!audioResponse.ok) {
          const errorData = await audioResponse.json();
          throw new Error(errorData.error || 'Failed to generate audio');
        }

        const audioData = await audioResponse.json();
        
        if (!audioData.success || !audioData.audioData) {
          throw new Error('Audio generation failed - no audio data received');
        }

        // Convert base64 to audio URL
        const audioBlob = new Blob([
          Uint8Array.from(atob(audioData.audioData), c => c.charCodeAt(0))
        ], { type: 'audio/mpeg' });
        
        generatedAudioUrl = URL.createObjectURL(audioBlob);
        audioInfo = {
          duration: audioData.duration,
          reqid: audioData.reqid,
          voice: selectedVoice
        };

        console.log('✅ Step 1 Complete - Audio generated successfully!');
        console.log('🎵 Duration:', audioData.duration ? `${audioData.duration}ms` : 'Unknown');
        
        setUploadStatus(`✅ Step 1/4: Audio generated with voice "${selectedVoice}"!`);
        
      } catch (audioError) {
        console.error('❌ Error in audio generation:', audioError);
        throw new Error(`Audio generation failed: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`);
      }

      // Step 1: Upload avatars
      setIsUploading(true);
      setUploadStatus('Step 2/4: Uploading avatars...');
      
      const uploadedAssets: AvatarAsset[] = [];
      let avatarGroup: AvatarGroup | null = null;

      for (let i = 0; i < selectedAvatars.length; i++) {
        const avatar = selectedAvatars[i];
        setUploadStatus(`Step 2/4: Processing ${avatar.filename || 'Generated Avatar'} (${i + 1}/${selectedAvatars.length})...`);

        let imageBlob: Blob;
        let contentType: string = 'image/jpeg';
        
        if (avatar.url.startsWith('blob:')) {
          const response = await fetch(avatar.url);
          if (!response.ok) throw new Error('Failed to fetch image');
          
          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          if (uint8Array.length >= 4) {
            if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
              contentType = 'image/png';
            } else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
              contentType = 'image/jpeg';
            }
          }
          imageBlob = new Blob([arrayBuffer], { type: contentType });
        } else {
          const response = await fetch(avatar.url);
          if (!response.ok) throw new Error('Failed to fetch image');
          imageBlob = await response.blob();
          
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          if (uint8Array.length >= 4) {
            if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
              contentType = 'image/png';
            } else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
              contentType = 'image/jpeg';
            } else {
              contentType = imageBlob.type || 'image/jpeg';
            }
          } else {
            contentType = imageBlob.type || 'image/jpeg';
          }
          
          imageBlob = new Blob([arrayBuffer], { type: contentType });
        }

        const formData = new FormData();
        formData.append('file', imageBlob, avatar.filename || 'avatar.jpg');

        const uploadResponse = await fetch('/api/heygen-upload-asset', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image to HeyGen');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success || !uploadData.asset.imageKey) {
          throw new Error('Upload successful but no image key received');
        }

        const newAsset: AvatarAsset = {
          id: uploadData.asset.id,
          imageKey: uploadData.asset.imageKey,
          filename: avatar.filename || 'avatar.jpg',
          url: avatar.url,
          contentType: contentType,
          uploadedAt: new Date().toISOString()
        };

        uploadedAssets.push(newAsset);

        if (i === 0) {
          const avatarName = avatar.filename?.replace(/\.[^/.]+$/, '') || `Avatar Group ${Date.now()}`;
          
          const groupResponse = await fetch('/api/heygen-create-avatar-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageKey: uploadData.asset.imageKey,
              avatarName: avatarName
            }),
          });

          if (!groupResponse.ok) {
            const errorData = await groupResponse.json();
            throw new Error(errorData.error || 'Failed to create avatar group');
          }

          const groupData = await groupResponse.json();
          if (!groupData.success) {
            throw new Error('Avatar group creation failed');
          }

          avatarGroup = groupData.avatarGroup;
        } else if (avatarGroup) {
          const lookName = avatar.filename?.replace(/\.[^/.]+$/, '') || `Look ${uploadedAssets.length}`;
          
          const addLookResponse = await fetch('/api/heygen-add-looks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              avatarGroupId: avatarGroup.id,
              imageKey: uploadData.asset.imageKey,
              name: lookName
            }),
          });

          if (!addLookResponse.ok) {
            const errorData = await addLookResponse.json();
            throw new Error(errorData.error || 'Failed to add look to avatar group');
          }
        }
      }

      if (!avatarGroup) {
        throw new Error('Failed to create avatar group');
      }

      setUploadStatus(`✅ Step 2/4: Successfully uploaded ${selectedAvatars.length} avatar${selectedAvatars.length > 1 ? 's' : ''}!`);

      // Step 2: Add motion to ALL avatars in parallel
      setIsUploading(false);
      setIsAddingMotion(true);
      setMotionStatus('Step 3/4: Getting avatars from group...');

      const avatarsResponse = await fetch(`/api/heygen-list-avatars-in-group?groupId=${avatarGroup.id}`);
      
      if (!avatarsResponse.ok) {
        const errorData = await avatarsResponse.json();
        throw new Error(errorData.error || 'Failed to get avatars from group');
      }

      const avatarsData = await avatarsResponse.json();
      if (!avatarsData.success || !avatarsData.avatars || avatarsData.avatars.length === 0) {
        throw new Error('No avatars found in the avatar group');
      }

      // Wait for all avatars to complete processing before adding motion
      setMotionStatus('Step 3/4: Waiting for avatars to complete processing...');
      await waitForAvatarsCompletion(avatarsData.avatars);

      // Add motion to ALL avatars in parallel
      setMotionStatus(`Step 3/4: Adding motion to ${avatarsData.avatars.length} avatar${avatarsData.avatars.length > 1 ? 's' : ''} in parallel...`);
      
      const motionPromises = avatarsData.avatars.map(async (avatar: any, index: number) => {
        try {
          console.log(`🎬 Starting motion for avatar ${index + 1}: "${avatar.name}"`);
          
          const motionResponse = await fetch('/api/heygen-add-motion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              avatarId: avatar.id
            }),
          });

          if (!motionResponse.ok) {
            const errorData = await motionResponse.json();
            console.error(`❌ Motion failed for avatar "${avatar.name}":`, errorData.error);
            return { 
              success: false,
              avatarName: avatar.name, 
              avatarId: avatar.id, 
              error: errorData.error || 'Failed to add motion' 
            };
          }

          const motionData = await motionResponse.json();
          if (!motionData.success || !motionData.motionAvatarId) {
            console.error(`❌ Motion failed for avatar "${avatar.name}": No motion avatar ID received`);
            return { 
              success: false, 
              avatarName: avatar.name, 
              avatarId: avatar.id, 
              error: 'No motion avatar ID received' 
            };
          }

          console.log(`✅ Motion started for avatar "${avatar.name}": ${motionData.motionAvatarId}`);
          return {
            success: true,
            avatarName: avatar.name,
            avatarId: avatar.id,
            motionAvatarId: motionData.motionAvatarId
          };
        } catch (error) {
          console.error(`❌ Exception adding motion for avatar "${avatar.name}":`, error);
          return { 
            success: false,
            avatarName: avatar.name, 
            avatarId: avatar.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const motionResults = await Promise.all(motionPromises);
      const successfulMotions = motionResults.filter(result => result.success);
      const failedMotions = motionResults.filter(result => !result.success);

      if (failedMotions.length > 0) {
        console.warn(`⚠️ ${failedMotions.length} motion request(s) failed:`, failedMotions);
      }

      if (successfulMotions.length === 0) {
        throw new Error('All motion generation requests failed. Please try again.');
      }

      setMotionStatus(`✅ Step 3/4: Motion started for ${successfulMotions.length}/${avatarsData.avatars.length} avatars. Waiting for any to complete...`);

      // Monitor ALL motion avatars in parallel and progressively collect ready ones
      const maxAttempts = 100; // 5 minutes total
      let allReadyMotionAvatars: any[] = [];
      let attempts = 0;
      const minWaitTime = 12; // Wait at least 1 minute (12 cycles × 5s) for more avatars to complete
      let foundFirstAvatar = false;
      let firstAvatarFoundAt = 0;
      
      while (attempts < maxAttempts) {
        // Check all motion avatars in parallel
        const statusPromises = successfulMotions.map(async (motion) => {
          try {
            const motionStatusResponse = await fetch(`/api/heygen-photo-avatar-details?avatarId=${motion.motionAvatarId}`);
            
            if (!motionStatusResponse.ok) {
              return { 
                ...motion, 
                status: 'error', 
                error: `Status check failed: ${motionStatusResponse.status}` 
              };
            }

            const motionStatusData = await motionStatusResponse.json();
            
            if (!motionStatusData.success) {
              return { 
                ...motion, 
                status: 'error', 
                error: 'Status check unsuccessful' 
              };
            }

            return {
              ...motion,
              status: motionStatusData.status,
              isMotion: motionStatusData.isMotion,
              error: motionStatusData.error
            };
          } catch (error) {
            return { 
              ...motion, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Status check failed' 
            };
          }
        });

        const statusResults = await Promise.all(statusPromises);
        
        // Check for completed motion avatars
        const completedMotions = statusResults.filter(result => 
          result.status === 'completed' && result.isMotion
        );

        // Add any newly completed avatars to our collection
        for (const completed of completedMotions) {
          if (!allReadyMotionAvatars.some(existing => existing.motionAvatarId === completed.motionAvatarId)) {
            allReadyMotionAvatars.push(completed);
            console.log(`✅ Motion avatar ready: "${completed.avatarName}" (${completed.motionAvatarId}) - Total ready: ${allReadyMotionAvatars.length}/${successfulMotions.length}`);
            
            if (!foundFirstAvatar) {
              foundFirstAvatar = true;
              firstAvatarFoundAt = attempts;
              console.log(`🎯 First avatar ready at attempt ${attempts}, will wait ${minWaitTime} more cycles for others`);
            }
          }
        }

        // Check for any rejected or failed avatars
        const rejectedMotions = statusResults.filter(result => 
          result.status === 'moderation_rejected' || result.status === 'failed' || result.status === 'error'
        );

        if (rejectedMotions.length > 0) {
          console.warn('⚠️ Some motion avatars failed:', rejectedMotions);
          
          // Remove failed motions from our tracking list
          successfulMotions.splice(0, successfulMotions.length, 
            ...successfulMotions.filter(motion => 
              !rejectedMotions.some(rejected => rejected.motionAvatarId === motion.motionAvatarId)
            )
          );

          // If all motion avatars failed, throw error
          if (successfulMotions.length === 0) {
            const errors = rejectedMotions.map(r => `${r.avatarName}: ${r.error || r.status}`).join(', ');
            throw new Error(`All motion avatars failed: ${errors}`);
          }
        }

        // Check if we should continue or break
        const allCompleted = allReadyMotionAvatars.length === successfulMotions.length;
        const waitTimeExpired = foundFirstAvatar && (attempts - firstAvatarFoundAt) >= minWaitTime;
        const hasAtLeastOne = allReadyMotionAvatars.length > 0;
        
        if (allCompleted) {
          console.log(`🎉 All ${allReadyMotionAvatars.length} motion avatars completed!`);
          break;
        }
        
        if (waitTimeExpired && hasAtLeastOne) {
          console.log(`⏰ Wait time expired. Proceeding with ${allReadyMotionAvatars.length}/${successfulMotions.length} ready avatars`);
          break;
        }

        // Show progress for remaining motion avatars
        const processingCount = statusResults.filter(result => 
          result.status === 'processing' || result.status === 'pending'
        ).length;
        
        const remainingTime = Math.max(0, (maxAttempts - attempts - 1) * 5);
        const waitingMessage = foundFirstAvatar 
          ? `⏳ Step 3/4: ${allReadyMotionAvatars.length}/${successfulMotions.length} ready, ${processingCount} still processing... (waiting ${Math.max(0, minWaitTime - (attempts - firstAvatarFoundAt)) * 5}s more)`
          : `⏳ Step 3/4: ${processingCount} motion avatar${processingCount !== 1 ? 's' : ''} still processing... (${remainingTime}s remaining)`;
          
        setMotionStatus(waitingMessage);
                
        if (attempts < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
        attempts++;
      }
        
      if (allReadyMotionAvatars.length === 0) {
        throw new Error('No motion avatars completed processing within the time limit. Please try again later.');
      }

      console.log(`🎬 Final ready motion avatars:`, allReadyMotionAvatars.map(m => `"${m.avatarName}" (${m.motionAvatarId})`));
      setMotionStatus(`✅ Step 3/4: ${allReadyMotionAvatars.length} motion avatar(s) ready for video generation!`);

      // Step 3: Generate videos for ALL ready motion avatars
      setIsAddingMotion(false);
      setIsGeneratingVideo(true);
      setVideoGenerationStatus('Step 4/4: Starting video generation...');

      console.log('🎵 Using generated audio for video generation');
      setVideoGenerationStatus('Step 4/4: Uploading generated audio...');

      // Convert audio URL to File object for upload
      const audioResponse = await fetch(generatedAudioUrl);
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch generated audio');
      }
      
      const audioBlob = await audioResponse.blob();
      const audioFile = new File([audioBlob], `audio_${Date.now()}.mp3`, { type: 'audio/mpeg' });

      // Upload audio to HeyGen
      const uploadFormData = new FormData();
      uploadFormData.append('audio', audioFile);

      const audioUploadResponse = await fetch('/api/heygen-upload-audio', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!audioUploadResponse.ok) {
        const errorData = await audioUploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload audio to HeyGen');
      }

      const audioUploadData = await audioUploadResponse.json();
      if (!audioUploadData.success || !audioUploadData.asset.id) {
        throw new Error('Audio upload successful but no asset ID received');
      }

      const audioAssetId = audioUploadData.asset.id;
      console.log('✅ Audio uploaded to HeyGen with asset ID:', audioAssetId);

      setVideoGenerationStatus(`Step 4/4: Generating ${allReadyMotionAvatars.length} video(s) with uploaded audio...`);

      // Generate videos for ALL ready motion avatars in parallel
      const videoGenerationPromises = allReadyMotionAvatars.map(async (readyMotionAvatar, index) => {
        try {
          console.log(`🎬 Starting video generation ${index + 1}/${allReadyMotionAvatars.length} for "${readyMotionAvatar.avatarName}"`);
          
          const videoResponse = await fetch('/api/heygen-generate-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              assetId: readyMotionAvatar.motionAvatarId,
              audioAssetId: audioAssetId,
              title: `Avatar Video - ${readyMotionAvatar.avatarName} (Motion) - Voice: ${audioInfo.voice || 'Custom'}`
            }),
          });

          if (!videoResponse.ok) {
            const errorData = await videoResponse.json();
            console.error(`❌ Video generation failed for "${readyMotionAvatar.avatarName}":`, errorData.error);
            return {
              success: false,
              avatarName: readyMotionAvatar.avatarName,
              error: errorData.error || 'Failed to generate video'
            };
          }

          const videoData = await videoResponse.json();

          // Extract video ID from our API response
          let videoId = null;
          if (videoData.videoId) {
            videoId = videoData.videoId;
          } else if (videoData.data?.video_id) {
            videoId = videoData.data.video_id;
          } else if (videoData.data?.data?.video_id) {
            videoId = videoData.data.data.video_id;
          }
          
          if (videoData.success && videoId) {
            console.log(`✅ Video generation started for "${readyMotionAvatar.avatarName}": ${videoId}`);
            return {
              success: true,
              avatarName: readyMotionAvatar.avatarName,
              motionAvatarId: readyMotionAvatar.motionAvatarId,
              videoId: videoId,
              videoData: videoData
            };
          } else {
            console.error(`❌ Video generation failed for "${readyMotionAvatar.avatarName}": no video ID received`);
            return {
              success: false,
              avatarName: readyMotionAvatar.avatarName,
              error: 'No video ID received'
            };
          }
        } catch (error) {
          console.error(`❌ Exception generating video for "${readyMotionAvatar.avatarName}":`, error);
          return {
            success: false,
            avatarName: readyMotionAvatar.avatarName,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const videoResults = await Promise.all(videoGenerationPromises);
      const successfulVideos = videoResults.filter(result => result.success);
      const failedVideos = videoResults.filter(result => !result.success);

      if (failedVideos.length > 0) {
        console.warn(`⚠️ ${failedVideos.length} video generation(s) failed:`, failedVideos);
      }

      if (successfulVideos.length === 0) {
        throw new Error('All video generations failed. Please try again.');
      }

      // Add all successful videos to the state
      const newVideos: GeneratedVideo[] = successfulVideos.map((result, index) => {
        // Find the original avatar image URL by matching avatar name
        const originalAvatar = selectedAvatars.find(avatar => {
          const avatarName = avatar.filename?.replace(/\.[^/.]+$/, '') || avatar.filename;
          return avatarName === result.avatarName;
        });
        
        return {
          id: `video_${Date.now()}_${index}`,
          videoId: result.videoId,
          status: 'processing',
          assetId: result.motionAvatarId,
          voiceId: audioInfo.voice || 'Custom Audio',
          text: `Audio: ${audioInfo.voice || 'Custom Voice'} | Avatar: ${result.avatarName}`,
          createdAt: new Date().toISOString(),
          originalAvatarImageUrl: originalAvatar?.url // Store original avatar image URL for keyframe extraction
        };
      });

      updateAvatarSession({ generatedVideos: [...generatedVideos, ...newVideos] });
      
      // Start checking video status for all videos
      successfulVideos.forEach(result => {
        startVideoStatusIntervalWithSessionUpdate(result.videoId);
      });

      const avatarNames = successfulVideos.map(r => r.avatarName).join('", "');
      setVideoGenerationStatus(`🎬 Step 4/4: ${successfulVideos.length} video(s) generation started with "${avatarNames}" and custom audio! Processing...`);

      // Clear selection after successful workflow
      clearSelection();

      let successMessage = `✅ Complete video workflow finished! Generated ${successfulVideos.length} video(s) with voice "${audioInfo.voice}".`;
      if (failedVideos.length > 0) {
        successMessage += ` ${failedVideos.length} video(s) failed.`;
      }
      successMessage += ` Videos are being processed...`;
      
      setSuccessNotification(successMessage);

    } catch (error) {
      console.error('Error in complete video generation workflow:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setUploadStatus('');
      setMotionStatus('');
      setVideoGenerationStatus('');
    } finally {
      setIsUploading(false);
      setIsAddingMotion(false);
      setIsGeneratingVideo(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Avatar Session Sidebar */}
      <AvatarSessionSidebar
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        productId={productId}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {/* Back Button */}
          {productId && (
            <div className="mb-4">
              <button
                onClick={() => router.push(`/product/${productId}`)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span>←</span>
                <span>Back to Product</span>
              </button>
            </div>
          )}
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-center mb-2">
              {productId ? `Avatar Video Creator - Product ${productId}` : 'Avatar Video Creator - Testing'}
            </h1>
            <p className="text-gray-600 text-center">
              {productId 
                ? `Create avatar videos for ${decodeURIComponent(productName || `Product ${productId}`)}`
                : 'Choose multiple existing images or generate new avatars for video creation'
              }
            </p>
            
            {/* Product Information Section */}
            {productId && productName && (
              <div className="mt-6 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800">Creating Avatar Video for Product</h3>
                    <p className="text-blue-600 mt-1">
                      <strong>Product:</strong> {decodeURIComponent(productName)} (ID: {productId})
                    </p>
                    <p className="text-sm text-blue-500 mt-1">
                      This avatar video will be associated with the selected product.
                    </p>
                  </div>
                  <div className="text-4xl">🎬</div>
                </div>
              </div>
            )}
            
            {/* Session Info Panel */}
            <SessionInfoPanel avatarSession={avatarSession} />

            {/* Debug Panel - only show if any processing state is true */}
            {(isUploading || isAddingMotion || isGeneratingVideo) && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Processing Status</h4>
                    <p className="text-xs text-yellow-600 mt-1">
                      Uploading: {isUploading ? '✅' : '❌'} | 
                      Adding Motion: {isAddingMotion ? '✅' : '❌'} | 
                      Generating Video: {isGeneratingVideo ? '✅' : '❌'}
                    </p>
                  </div>
                  <button
                    onClick={resetAllStates}
                    className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  >
                    Reset States
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Success Notification */}
          <NotificationPanel 
            successNotification={successNotification}
            error={error}
          />

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => updateAvatarSession({ activeTab: 'existing' })}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'existing'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Choose Existing Images
              </button>
              <button
                onClick={() => updateAvatarSession({ activeTab: 'generate' })}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'generate'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Generate New Avatar
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'existing' && (
            <ExistingImagesTab
              existingImages={existingImages}
              selectedAvatars={selectedAvatars}
              loading={loading}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
              onSelectImage={selectExistingImage}
              onSelectAll={selectAllImages}
              onClearSelection={clearSelection}
            />
          )}

          {activeTab === 'generate' && (
            <GenerateAvatarTab
              avatarDescription={avatarDescription}
              setAvatarDescription={(description) => updateAvatarSession({ avatarDescription: description })}
              avatarPrompts={avatarPrompts}
              isOptimizing={isOptimizing}
              onGeneratePrompt={generatePrompt}
              onPromptEdit={handlePromptEdit}
              onGenerateAvatars={generateAvatars}
              onSelectGeneratedAvatar={selectGeneratedAvatar}
              onSelectAllGenerated={selectAllGeneratedAvatars}
              selectedAvatars={selectedAvatars}
              conversation={conversation}
              error={error}
              selectedCombinedOption={selectedCombinedOption}
              onRatioResolutionChange={handleRatioResolutionChange}
            />
          )}

          {/* Video Generation Panel - Uses local video text with debounced saving */}
          <VideoGenerationPanel
            videoText={localVideoText}
            setVideoText={setLocalVideoText}
            avatarSession={avatarSession}
            isGeneratingVideo={isGeneratingVideo}
            videoGenerationStatus={videoGenerationStatus}
            onLoadVoices={() => {}}
            isAddingMotion={isAddingMotion}
            motionStatus={motionStatus}
            avatarDescription={avatarDescription}
            selectedAvatars={selectedAvatars}
          />

          {/* Selected Avatars Panel */}
          <SelectedAvatarsPanel
            selectedAvatars={selectedAvatars}
            isUploading={isUploading}
            uploadStatus={uploadStatus}
            isAddingMotion={isAddingMotion}
            motionStatus={motionStatus}
            isGeneratingVideo={isGeneratingVideo}
            videoGenerationStatus={videoGenerationStatus}
            avatarSession={avatarSession}
            onGenerateCompleteVideo={generateCompleteVideo}
            onRemoveAvatar={removeSelectedAvatar}
          />

          {/* Generated Videos Display */}
          <GeneratedVideosDisplay
            generatedVideos={generatedVideos}
            forceRender={forceRender}
            productId={productId}
            productName={productName}
          />
        </div>
      </div>
    </div>
  );
}