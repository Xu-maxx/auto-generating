import { useState, useRef } from 'react';
import { GeneratedVideo, ExistingImage, GeneratedAvatar } from '../types';
import { AvatarSessionData, AvatarAsset } from '@/utils/avatarSessionManager';

export const useVideoGeneration = () => {
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<string>('');
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [videoText, setVideoText] = useState('hello world my name is Amy how are you I am fine thank you');
  const [forceRender, setForceRender] = useState(0);
  const [isAddingMotion, setIsAddingMotion] = useState(false);
  const [motionStatus, setMotionStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [statusCheckIntervals, setStatusCheckIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const checkVideoStatus = async (videoId: string) => {
    try {
      const response = await fetch(`/api/heygen-video-status?videoId=${videoId}`);
      const data = await response.json();
      
      if (data.success) {
        setGeneratedVideos(prev => prev.map(video => {
          if (video.videoId === videoId) {
            const updatedVideo = {
              ...video,
              status: data.status,
              videoUrl: data.videoUrl || video.videoUrl,
              thumbnailUrl: data.thumbnailUrl || video.thumbnailUrl,
              duration: data.duration || video.duration,
              videoData: data.data || video.videoData
            };
            
            // Force re-render when video URL is available
            if (data.videoUrl && !video.videoUrl) {
              console.log('🎬 NEW VIDEO URL DETECTED! Forcing re-render...');
              setForceRender(prev => prev + 1);
            }
            
            return updatedVideo;
          }
          return video;
        }));
        
        // Stop polling if video is completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          clearVideoStatusInterval(videoId);
          
          if (data.status === 'completed' && data.videoUrl) {
            console.log('🎬 Video generation completed successfully!');
            // Success notification will be handled in the component
          } else if (data.status === 'failed') {
            console.log('❌ Video generation failed');
          }
        }
      } else {
        console.error('Failed to check video status:', data.error);
      }
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  };

  const startVideoStatusInterval = (videoId: string) => {
    const interval = setInterval(() => {
      checkVideoStatus(videoId);
    }, 5000); // Check every 5 seconds
    
    setStatusCheckIntervals(prev => new Map(prev.set(videoId, interval)));
  };

  const clearVideoStatusInterval = (videoId: string) => {
    const interval = statusCheckIntervals.get(videoId);
    if (interval) {
      clearInterval(interval);
      setStatusCheckIntervals(prev => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });
    }
  };

  const clearAllVideoStatusIntervals = () => {
    statusCheckIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    setStatusCheckIntervals(new Map());
  };

  const waitForAvatarsCompletion = async (avatars: any[], maxWaitTime = 600000) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      let allCompleted = true;
      
      for (const avatar of avatars) {
        try {
          const response = await fetch(`/api/heygen-photo-avatar-details?avatarId=${avatar.id}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
              if (data.status !== 'completed') {
                allCompleted = false;
                console.log(`Avatar ${avatar.id} status: ${data.status}`);
              }
              
              if (data.status === 'moderation_rejected') {
                throw new Error(`Avatar ${avatar.name} was rejected by moderation`);
              } else if (data.status === 'failed' || data.status === 'error') {
                throw new Error(`Avatar ${avatar.name} processing failed`);
              }
            } else {
              console.error(`Failed to get status for avatar ${avatar.id}:`, data.error);
              allCompleted = false;
            }
          } else {
            console.error(`HTTP error getting status for avatar ${avatar.id}:`, response.status);
            allCompleted = false;
          }
        } catch (error) {
          console.error(`Error checking avatar ${avatar.id}:`, error);
          throw error;
        }
      }
      
      if (allCompleted) {
        console.log('✅ All avatars completed processing');
        return;
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Timeout waiting for avatars to complete processing');
  };

  return {
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
  };
}; 