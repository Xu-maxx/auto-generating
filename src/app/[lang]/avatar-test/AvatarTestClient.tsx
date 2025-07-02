'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AvatarSessionManager, AvatarSessionData, AvatarAsset, AvatarGroup } from '@/utils/avatarSessionManager';

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

export default function AvatarTestClient({ dict }: AvatarTestClientProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'generate'>('existing');
  const [successNotification, setSuccessNotification] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use custom hooks
  const { avatarSession, setAvatarSession } = useAvatarSession();
  const {
    existingImages,
    selectedAvatars,
    setExistingImages,
    setSelectedAvatars,
    loadExistingImages,
    handleFileUpload,
    selectExistingImage,
    selectGeneratedAvatar,
    selectAllImages,
    clearSelection,
    selectAllGeneratedAvatars
  } = useImageManagement();
  
  const {
    avatarDescription,
    setAvatarDescription,
    isOptimizing,
    avatarPrompts,
    setAvatarPrompts,
    conversation,
    error,
    setError,
    generatePrompt,
    handlePromptEdit,
    generateAvatars
  } = useAvatarPrompts();

  const {
    isGeneratingVideo,
    videoGenerationStatus,
    generatedVideos,
    videoText,
    forceRender,
    isAddingMotion,
    motionStatus,
    isUploading,
    uploadStatus,
    statusCheckIntervals,
    setIsGeneratingVideo,
    setVideoGenerationStatus,
    setGeneratedVideos,
    setVideoText,
    setForceRender,
    setIsAddingMotion,
    setMotionStatus,
    setIsUploading,
    setUploadStatus,
    setStatusCheckIntervals,
    checkVideoStatus,
    startVideoStatusInterval,
    clearVideoStatusInterval,
    clearAllVideoStatusIntervals,
    waitForAvatarsCompletion
  } = useVideoGeneration();

  // State for generated audio from VideoGenerationPanel
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>('');
  const [generatedAudioInfo, setGeneratedAudioInfo] = useState<{ duration?: string; reqid?: string; voice?: string }>({});

  // Audio handling callbacks
  const handleAudioGenerated = (audioUrl: string, audioInfo: { duration?: string; reqid?: string; voice?: string }) => {
    console.log('🎵 Audio generated for complete workflow:', { audioUrl: audioUrl.substring(0, 50) + '...', audioInfo });
    setGeneratedAudioUrl(audioUrl);
    setGeneratedAudioInfo(audioInfo);
  };

  const handleAudioCleared = () => {
    console.log('🗑️ Audio cleared');
    setGeneratedAudioUrl('');
    setGeneratedAudioInfo({});
  };

  // Load existing images on component mount
  useEffect(() => {
    loadExistingImages();
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      clearAllVideoStatusIntervals();
    };
  }, []);

  const generateCompleteVideo = async () => {
    if (selectedAvatars.length === 0) {
      setError('Please select at least one avatar');
      return;
    }

    if (!videoText.trim()) {
      setError('Please enter text for the video');
      return;
    }

    try {
      // Step 1: Upload avatars
    setIsUploading(true);
      setUploadStatus('Step 1/3: Uploading avatars...');
    setError(null);
      
      const uploadedAssets: AvatarAsset[] = [];
      let avatarGroup: AvatarGroup | null = null;

      for (let i = 0; i < selectedAvatars.length; i++) {
        const avatar = selectedAvatars[i];
        setUploadStatus(`Step 1/3: Processing ${avatar.filename || 'Generated Avatar'} (${i + 1}/${selectedAvatars.length})...`);

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

      // Update session
      const newSessionData: AvatarSessionData = {
        id: avatarSession?.id || `avatar_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: avatarSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        avatarGroup: avatarGroup,
        uploadedAssets: uploadedAssets
      };

      const saveResponse = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save', 
          sessionData: newSessionData 
        })
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        setAvatarSession(saveData.session);
      } else {
        setAvatarSession(newSessionData);
      }

      setUploadStatus(`✅ Step 1/3: Successfully uploaded ${selectedAvatars.length} avatar${selectedAvatars.length > 1 ? 's' : ''}!`);

      // Step 2: Add motion to ALL avatars in parallel
      setIsUploading(false);
      setIsAddingMotion(true);
      setMotionStatus('Step 2/3: Getting avatars from group...');

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
      setMotionStatus('Step 2/3: Waiting for avatars to complete processing...');
      await waitForAvatarsCompletion(avatarsData.avatars);

      // Add motion to ALL avatars in parallel
      setMotionStatus(`Step 2/3: Adding motion to ${avatarsData.avatars.length} avatar${avatarsData.avatars.length > 1 ? 's' : ''} in parallel...`);
      
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

      setMotionStatus(`✅ Step 2/3: Motion started for ${successfulMotions.length}/${avatarsData.avatars.length} avatars. Waiting for any to complete...`);

      // Monitor ALL motion avatars in parallel and use the first one that's ready
      const maxAttempts = 100; // 5 minutes total
      let readyMotionAvatar = null;
      let attempts = 0;
      
      while (attempts < maxAttempts && !readyMotionAvatar) {
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

        if (completedMotions.length > 0) {
          readyMotionAvatar = completedMotions[0]; // Use first completed motion avatar
          console.log(`🎬 Motion avatar ready: "${readyMotionAvatar.avatarName}" (${readyMotionAvatar.motionAvatarId})`);
          break;
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

        // Show progress for remaining motion avatars
        const processingCount = statusResults.filter(result => 
          result.status === 'processing' || result.status === 'pending'
        ).length;
        
        const remainingTime = Math.max(0, (maxAttempts - attempts - 1) * 5);
        setMotionStatus(
          `⏳ Step 2/3: ${processingCount} motion avatar${processingCount !== 1 ? 's' : ''} still processing... (${remainingTime}s remaining)`
        );

        if (attempts < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
        attempts++;
      }
        
      if (!readyMotionAvatar) {
        throw new Error('No motion avatars completed processing within the time limit. Please try again later.');
      }

      setMotionStatus(`✅ Step 2/3: Motion avatar "${readyMotionAvatar.avatarName}" ready for video generation!`);

      // Step 3: Generate video with the ready motion avatar
      setIsAddingMotion(false);
      setIsGeneratingVideo(true);
      setVideoGenerationStatus('Step 3/3: Starting video generation...');

      // Check if we have generated audio - REQUIRED for this workflow
      if (!generatedAudioUrl) {
        throw new Error('No generated audio found. Please generate audio first before creating video.');
      }

      console.log('🎵 Using generated audio for video generation');
      setVideoGenerationStatus('Step 3/3: Uploading generated audio...');

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

      setVideoGenerationStatus('Step 3/3: Generating video with uploaded audio...');

      // Generate video with audio asset using the ready motion avatar
      const videoResponse = await fetch('/api/heygen-generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: readyMotionAvatar.motionAvatarId,
          audioAssetId: audioAssetId,
          title: `Avatar Video - ${readyMotionAvatar.avatarName} (Motion) - Voice: ${generatedAudioInfo.voice || 'Custom'}`
        }),
      });

      if (!videoResponse.ok) {
        const errorData = await videoResponse.json();
        throw new Error(errorData.error || 'Failed to generate video');
      }

      const videoData = await videoResponse.json();

      // Extract video ID from our API response (which transforms the HeyGen response)
      let videoId = null;
      if (videoData.videoId) {
        videoId = videoData.videoId;
      } else if (videoData.data?.video_id) {
        videoId = videoData.data.video_id;
      } else if (videoData.data?.data?.video_id) {
        videoId = videoData.data.data.video_id;
      }
      
      // Check if API call was successful and we have a video ID
      if (videoData.success && videoId) {
        const newVideo: GeneratedVideo = {
          id: `video_${Date.now()}`,
          videoId: videoId,
          status: 'processing',
          assetId: readyMotionAvatar.motionAvatarId,
          voiceId: generatedAudioInfo.voice || 'Custom Audio',
          text: `Audio: ${generatedAudioInfo.voice || 'Custom Voice'} | Avatar: ${readyMotionAvatar.avatarName}`,
          createdAt: new Date().toISOString()
        };

        setGeneratedVideos(prev => [...prev, newVideo]);
        setVideoGenerationStatus(`🎬 Step 3/3: Video generation started with "${readyMotionAvatar.avatarName}" and custom audio! Video ID: ${videoId} - Processing...`);

        // Start checking video status
        startVideoStatusInterval(videoId);

        // Clear selection after successful workflow
        setSelectedAvatars([]);
        setExistingImages(prev => prev.map(img => ({ ...img, selected: false })));

        setSuccessNotification(`✅ Complete video workflow finished! Using avatar "${readyMotionAvatar.avatarName}" with custom audio. Video is being processed...`);

      } else {
        console.error('Video generation failed. Response:', videoData);
        throw new Error(`Video generation failed - ${videoData.error || 'no video ID received'}`);
      }

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
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Avatar Video Creator - Testing</h1>
        <p className="text-gray-600 text-center">Choose multiple existing images or generate new avatars for video creation</p>
        
        {/* Session Info Panel */}
        <SessionInfoPanel avatarSession={avatarSession} />
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
            onClick={() => setActiveTab('existing')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'existing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Choose Existing Images
          </button>
          <button
            onClick={() => setActiveTab('generate')}
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
          setAvatarDescription={setAvatarDescription}
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
        />
      )}

      {/* Video Generation Panel - MOVED BEFORE SelectedAvatarsPanel */}
      <VideoGenerationPanel
        videoText={videoText}
        setVideoText={setVideoText}
        avatarSession={avatarSession}
        isGeneratingVideo={isGeneratingVideo}
        videoGenerationStatus={videoGenerationStatus}
        onLoadVoices={() => {}}
        isAddingMotion={isAddingMotion}
        motionStatus={motionStatus}
        avatarDescription={avatarDescription}
        selectedAvatars={selectedAvatars}
        onAudioGenerated={handleAudioGenerated}
        onAudioCleared={handleAudioCleared}
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
      />

      {/* Generated Videos Display */}
      <GeneratedVideosDisplay
        generatedVideos={generatedVideos}
        forceRender={forceRender}
      />
    </div>
  );
} 