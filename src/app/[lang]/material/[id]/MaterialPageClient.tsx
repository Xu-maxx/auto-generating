'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/FileUpload';
import PromptGenerator from '@/components/PromptGenerator';
import SessionSidebar from '@/components/SessionSidebar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MaterialSubmissionButton from '@/components/MaterialSubmissionButton';
import { useProjectSession } from '@/hooks/useProjectSession';
import { GeneratedImage, VideoGenerationTask, PromptWithSpec, ConversationMessage, ReferenceImage } from '@/types/session';
import { ProjectData } from '@/types/project';
import {
  detectImageDimensions,
  findClosestAspectRatio,
  getBestResolution
} from '@/utils/imageRatioUtils';
import ApiClient from '@/utils/apiClient';

interface MaterialPageClientProps {
  params: Promise<{ lang: string; id: string }>;
  dict: any;
}

export default function MaterialPageClient({ params, dict }: MaterialPageClientProps) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [productId, setProductId] = useState('');
  
  const [product, setProduct] = useState<ProjectData | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  
  const { currentSession, loading: sessionLoading, loadSession, createSession, updateSession } = useProjectSession(productId);
  
  // Local state for non-persistent UI states
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoGenerationTask | null>(null);
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  
  // Ref to store current video tasks to avoid stale state issues
  const currentVideoTasksRef = useRef<VideoGenerationTask[]>([]);
  
  // Global state for parallel processing control
  const [isApiChannelOccupied, setIsApiChannelOccupied] = useState(false);

  // Get locale and productId from params
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.lang);
      setProductId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  // Load product data
  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) return;
      
      try {
        setProductLoading(true);
        
        // Get token from ApiClient
        const apiClient = ApiClient.getInstance();
        const token = apiClient.getToken();
        
        if (!token) {
          router.push(`/${locale}/login`);
          return;
        }
        
        // Since we're working with product IDs directly, we can load the product info
        // and create a virtual project object for UI purposes
        const response = await fetch(`/api/products?pageSize=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        
        if (data.success) {
          const foundProduct = data.products.find((p: any) => p.id === parseInt(productId));
          if (foundProduct) {
            // Create a virtual project object from product data
            const virtualProject: ProjectData = {
              id: productId,
              name: `${foundProduct.productName} - Material Video`,
              style: `Material video project for ${foundProduct.productName}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sessionCount: 0
            };
            setProduct(virtualProject);
          } else {
            console.error('Product not found:', productId);
            router.push(`/${locale}`);
          }
        } else {
          console.error('Error loading products:', data.error);
          if (data.error === 'Not authenticated') {
            apiClient.clearToken();
            router.push(`/${locale}/login`);
          } else {
            router.push(`/${locale}`);
          }
        }
      } catch (error) {
        console.error('Error loading product:', error);
        router.push(`/${locale}`);
      } finally {
        setProductLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId, router, locale]);

  // Session-based state getters
  const imageDataUrl = currentSession?.imageDataUrl || '';
  const selectedImages = new Set(currentSession?.selectedImages || []);
  const addedImages = currentSession?.addedImages || [];
  const referenceImages = currentSession?.referenceImages || [];
  const videoPrompt = currentSession?.videoPrompt || '';
  const folderName = currentSession?.folderName || '';
  const aspectRatio = currentSession?.aspectRatio || '16:9';
  const imageAspectRatio = currentSession?.imageAspectRatio || '16:9';
  const imageResolution = currentSession?.imageResolution || {width: 1920, height: 1080};
  const videoTasks = currentSession?.videoTasks || [];
  const isGeneratingVideo = currentSession?.isGeneratingVideo || false;
  const prompts = currentSession?.prompts || [];
  const conversation = currentSession?.conversation || [];
  const userRequirement = currentSession?.userRequirement || '';

  // Update ref whenever videoTasks change
  currentVideoTasksRef.current = videoTasks;

  // Sync session name with folder name when session loads
  useEffect(() => {
    if (currentSession && folderName) {
      const expectedSessionName = folderName.trim() || 'untitled';
      if (currentSession.name !== expectedSessionName) {
        console.log(`🏷️ Syncing session name: "${currentSession.name}" → "${expectedSessionName}"`);
        updateSession({ name: expectedSessionName });
      }
    }
  }, [currentSession?.id, folderName, updateSession]);

  // Debug: Monitor videoTasks changes
  useEffect(() => {
    console.log('🎬 VIDEO TASKS CHANGED:', {
      sessionId: currentSession?.id,
      count: videoTasks.length,
      details: videoTasks.map(task => ({ 
        taskId: task.taskId, 
        imageName: task.imageName, 
        status: task.status 
      }))
    });
  }, [videoTasks, currentSession?.id]);

  // Session state updaters
  const setSelectedImages = (images: Set<string>) => {
    updateSession({ selectedImages: Array.from(images) });
  };

  const setAddedImages = (images: GeneratedImage[]) => {
    updateSession({ addedImages: images });
  };

  const setVideoPrompt = (prompt: string) => {
    updateSession({ videoPrompt: prompt });
  };

  const setFolderName = (name: string) => {
    // Update both folder name and session name to keep them in sync
    const sessionName = name.trim() || 'untitled';
    updateSession({ 
      folderName: name,
      name: sessionName
    });
  };

  const setAspectRatio = (ratio: string) => {
    updateSession({ aspectRatio: ratio });
  };

  const setIsGeneratingVideo = (generating: boolean) => {
    updateSession({ isGeneratingVideo: generating });
  };

  const setPrompts = (newPrompts: PromptWithSpec[]) => {
    updateSession({ prompts: newPrompts });
  };

  const setConversation = (newConversation: ConversationMessage[]) => {
    updateSession({ conversation: newConversation });
  };

  const setUserRequirement = (requirement: string) => {
    updateSession({ userRequirement: requirement });
  };

  const setReferenceImages = (images: ReferenceImage[]) => {
    updateSession({ referenceImages: images });
  };

  // Combined update function for prompt-related state to avoid race conditions
  const updatePromptSession = (updates: {
    prompts?: PromptWithSpec[];
    conversation?: ConversationMessage[];
    userRequirement?: string;
  }) => {
    updateSession(updates);
  };

  const handleImageExtracted = async (dataUrl: string) => {
    console.log('🖼️ handleImageExtracted called with dataUrl length:', dataUrl.length);
    
    // First update the image data URL
    updateSession({ imageDataUrl: dataUrl });
    
    // Auto-detect image dimensions and set aspect ratio for video generation
    try {
      console.log('🔍 Starting dimension detection for video aspect ratio...');
      const dimensions = await detectImageDimensions(dataUrl);
      console.log('📏 Detected image dimensions:', dimensions);
      
      const closestRatio = findClosestAspectRatio(dimensions);
      console.log('🎯 Closest aspect ratio found:', closestRatio);
      
      // Update the video aspect ratio to match the detected image ratio
      console.log('📹 Updating video aspect ratio to:', closestRatio.value);
      updateSession({ aspectRatio: closestRatio.value });
      console.log('✅ Video aspect ratio updated successfully');
    } catch (error) {
      console.error('❌ Failed to detect image dimensions for video aspect ratio:', error);
      // Don't throw the error, just log it
    }
  };

  const handleRatioResolutionChange = (newAspectRatio: string, newResolution: {width: number, height: number}) => {
    console.log('🔄 handleRatioResolutionChange called:', { newAspectRatio, newResolution });
    
    // Update both image generation settings AND video aspect ratio to keep them in sync
    updateSession({ 
      imageAspectRatio: newAspectRatio, 
      imageResolution: newResolution,
      aspectRatio: newAspectRatio // Keep video aspect ratio in sync with image aspect ratio
    });
    
    console.log('✅ Both image and video aspect ratios updated to:', newAspectRatio);
  };

  const handleImageReset = () => {
    updateSession({ imageDataUrl: '' });
  };

  const handleSessionSelect = async (sessionId: string) => {
    if (currentSession?.id !== sessionId) {
      await loadSession(sessionId);
    }
  };

  const handleNewSession = async () => {
    await createSession();
  };

  const handleImageDoubleClick = (image: GeneratedImage) => {
    setPreviewImage(image);
  };

  const closePreview = () => {
    setPreviewImage(null);
  };

  const addSelectedImages = (allImages: GeneratedImage[]) => {
    const imagesToAdd: GeneratedImage[] = [];
    
    allImages.forEach(image => {
      if (selectedImages.has(image.taskId) && !addedImages.find(added => added.taskId === image.taskId)) {
        imagesToAdd.push(image);
      }
    });

    const newAddedImages = [...addedImages, ...imagesToAdd];
    
    // Combine both updates into a single call to avoid race condition
    updateSession({ 
      addedImages: newAddedImages,
      selectedImages: [] // Clear selections after adding
    });
  };

  const removeFromAdded = (taskId: string) => {
    const newAddedImages = addedImages.filter(img => img.taskId !== taskId);
    setAddedImages(newAddedImages);
  };

  const clearAll = () => {
    setSelectedImages(new Set());
    setAddedImages([]);
  };

  // Placeholder for video generation logic
  const generateVideos = async () => {
    console.log('🚀 generateVideos function called - START');
    
    if (!videoPrompt.trim()) {
      alert('Please enter a video generation prompt');
      return;
    }
    
    if (!folderName.trim()) {
      alert('Please enter a folder name');
      return;
    }
    
    if (addedImages.length === 0) {
      alert('Please add images first');
      return;
    }

    console.log('✅ generateVideos validation passed');
    console.log(`Starting video generation for ${addedImages.length} images:`, addedImages.map(img => img.filename));
    console.log('🖼️ Image URLs being sent to API:', addedImages.map(img => ({ 
      filename: img.filename, 
      url: img.url,
      isLocal: img.url.startsWith('/') || img.url.includes('localhost')
    })));

    // Combine both updates into a single call to avoid race condition
    updateSession({ 
      isGeneratingVideo: true
      // Don't clear videoTasks here - let them be set when API responds
    });
    
    console.log('🔄 Set isGeneratingVideo to true, starting API call...');

    try {
      const response = await fetch('/api/jimeng-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: videoPrompt,
          images: addedImages.map(img => ({
            url: img.url,
            filename: img.filename
          })),
          folderName: folderName,
          aspectRatio: aspectRatio
        }),
      });

      console.log('📡 API call completed, checking response...');
      console.log('🌐 RAW RESPONSE STATUS:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      const responseText = await response.text();
      console.log('📄 RAW RESPONSE TEXT:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ JSON PARSING SUCCESSFUL');
      } catch (parseError) {
        console.error('❌ JSON PARSING FAILED:', parseError);
        throw new Error(`Failed to parse API response: ${parseError}`);
      }

      console.log('🎬 RAW API RESPONSE:', {
        success: result.success,
        tasksReceived: result.tasks?.length || 0,
        resultKeys: Object.keys(result),
        fullResult: result
      });

      if (result.success) {
        console.log('🎬 Setting video tasks from API response:', {
          tasksReceived: result.tasks.length,
          taskDetails: result.tasks.map((t: VideoGenerationTask) => ({ imageName: t.imageName, status: t.status, taskId: t.taskId }))
        });
        
        // Update session directly with the tasks from API response to avoid race condition
        console.log('🚨 BEFORE updateSession - Current session video tasks:', currentSession?.videoTasks?.length || 0);
        updateSession({ videoTasks: result.tasks });
        currentVideoTasksRef.current = result.tasks; // Update ref immediately
        console.log('🚨 AFTER updateSession call - This should trigger session update');
        
        // Set API channel as occupied - all tasks are processed simultaneously
        setIsApiChannelOccupied(true);
        
        console.log('🔄 All-at-once processing state:', {
          totalTasks: result.tasks.length,
          submittedTasks: result.tasks.filter((t: VideoGenerationTask) => t.status === 'submitted').length,
          failedTasks: result.tasks.filter((t: VideoGenerationTask) => t.status === 'failed').length
        });
        
        const successfulTasks = result.tasks.filter((t: VideoGenerationTask) => t.status === 'submitted');
        const failedTasks = result.tasks.filter((t: VideoGenerationTask) => t.status === 'failed');
        
        console.log(`Generated ${result.tasks.length} total tasks:`, result.tasks);
        console.log(`${successfulTasks.length} successful, ${failedTasks.length} failed`);
        
        // Only show alerts for errors or complete failures
        if (successfulTasks.length === 0 && failedTasks.length > 0) {
          alert(`❌ All ${result.tasks.length} video generation tasks failed.\n\nThis might be due to API rate limits. Please wait a few minutes and try again with fewer images.`);
        }
        
        // Start polling for task completion with a small delay to avoid race conditions
        setTimeout(() => {
          result.tasks.forEach((task: VideoGenerationTask) => {
            if (task.taskId && task.status === 'submitted') {
              console.log(`Starting polling for task: ${task.taskId} (image: ${task.imageName})`);
              pollTaskStatus(task.taskId, task.imageIndex);
            }
          });
        }, 1500); // Wait 1.5 seconds to ensure video tasks are properly saved and state updated
      } else {
        throw new Error(result.error || 'Failed to generate videos');
      }
    } catch (error) {
      console.error('Error generating videos:', error);
      alert(`Error generating videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      updateSession({ isGeneratingVideo: false });
    }
  };

  // Helper function to handle task completion and manage active submissions
  const handleTaskCompletion = (taskId: string, reason: string) => {
    console.log(`🏁 Task ${taskId} completed: ${reason}`);
    
    // Clean up polling for this completed task
    setPollingTasks(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
    
    // Check if all tasks are completed to free up the API channel
    const currentTasks = currentVideoTasksRef.current;
    const hasActiveProcessing = currentTasks.some(task => 
      task.status === 'submitted' || task.status === 'processing' || task.status === 'downloading'
    );
    
    console.log(`🔍 API Channel Status Check:`, {
      hasActiveProcessing,
      currentTasks: currentTasks.map(t => ({ name: t.imageName, status: t.status })),
      shouldFreeChannel: !hasActiveProcessing
    });
    
    // Free API channel if no more active tasks
    if (!hasActiveProcessing) {
      console.log('🔓 Freeing API channel - all tasks completed');
      setIsApiChannelOccupied(false);
    }
  };

  const pollTaskStatus = async (taskId: string, imageIndex: number) => {
    // Prevent multiple polling instances for the same task
    if (pollingTasks.has(taskId)) {
      console.log(`Already polling task ${taskId}, skipping...`);
      return;
    }
    
    setPollingTasks(prev => new Set(prev).add(taskId));
    console.log(`Started polling for task ${taskId}`);
    
    const maxAttempts = 60; // Poll for up to 10 minutes (60 attempts * 10 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/jimeng-video?taskId=${taskId}`);
        const result = await response.json();
        
        console.log(`Polling task ${taskId}, attempt ${attempts + 1}:`, result);

        if (result.success && result.data?.status) {
          const taskResult = result.data;
          
          console.log(`Task ${taskId} status: ${taskResult.status}`);
          
          // Update task status
          console.log(`🔄 Updating task ${taskId} status from ${taskResult.status} to processing/completed/failed`);
          updateVideoTasks(prev => prev.map(task => 
            task.taskId === taskId ? {
              ...task,
              status: taskResult.status === 'done' ? 'completed' : 
                     taskResult.status === 'failed' ? 'failed' : 'processing',
              videoUrl: taskResult.status === 'done' ? taskResult.video_url : undefined,
              error: taskResult.status === 'failed' ? taskResult.error_message : undefined
            } : task
          ));

          // If task is completed, automatically download the video AND process next queued image
          if (taskResult.status === 'done' && taskResult.video_url) {
            console.log(`Video completed for task ${taskId}: ${taskResult.video_url}`);

            // Find the original image for this task
            const currentTask = (currentSession?.videoTasks || []).find(t => t.taskId === taskId);
            const originalImageName = currentTask?.imageName || `video_${imageIndex}`;
            
            // Find the original image URL from addedImages based on filename
            // Try exact match first, then fallback to partial matching
            let originalImage = addedImages.find(img => img.filename === originalImageName);
            
            if (!originalImage) {
              // Try to find by partial matching (remove extensions, etc.)
              const nameWithoutExt = originalImageName.replace(/\.[^/.]+$/, '');
              originalImage = addedImages.find(img => 
                img.filename.replace(/\.[^/.]+$/, '') === nameWithoutExt ||
                img.filename.includes(nameWithoutExt) ||
                nameWithoutExt.includes(img.filename.replace(/\.[^/.]+$/, ''))
              );
            }
            
            if (!originalImage && addedImages.length > 0) {
              // Last resort: use the image at the same index
              originalImage = addedImages[imageIndex] || addedImages[0];
              console.warn(`🔍 Using fallback image lookup for task ${taskId}:`, {
                originalImageName,
                fallbackImage: originalImage?.filename,
                reason: 'No exact or partial match found'
              });
            }
            
            const originalImageUrl = originalImage?.url || null;
            
            console.log(`🖼️ Original image lookup for task ${taskId}:`, {
              originalImageName,
              foundOriginalImage: !!originalImage,
              originalImageUrl: originalImageUrl ? originalImageUrl.substring(0, 50) + '...' : 'null',
              addedImagesCount: addedImages.length,
              allAddedImageNames: addedImages.map(img => img.filename),
              matchMethod: originalImage ? 
                (addedImages.find(img => img.filename === originalImageName) ? 'exact' : 'fallback') : 'none'
            });

            // Update task with video info - always use original source image as preview
            console.log(`🖼️ Setting video task properties for ${taskId}:`, {
              videoUrl: taskResult.video_url,
              originalImageUrl: originalImageUrl,
              willSetImageUrl: !!originalImageUrl,
              willSetPreviewUrl: !!originalImageUrl
            });

            updateVideoTasks(prev => prev.map(task => 
              task.taskId === taskId ? {
                ...task,
                status: 'downloaded',
                videoUrl: taskResult.video_url, // Store the video URL
                previewUrl: originalImageUrl || undefined, // Always use original source image as preview
                imageUrl: originalImageUrl || undefined // Store original image URL for material submission (same as preview)
              } : task
            ));

            // Verify the task was updated correctly
            setTimeout(() => {
              const updatedTask = currentVideoTasksRef.current.find(t => t.taskId === taskId);
              console.log(`🖼️ Verification - Task ${taskId} after update:`, {
                hasImageUrl: !!updatedTask?.imageUrl,
                hasPreviewUrl: !!updatedTask?.previewUrl,
                imageUrl: updatedTask?.imageUrl,
                previewUrl: updatedTask?.previewUrl,
                imageName: updatedTask?.imageName
              });
            }, 1000);

            // Handle task completion
            handleTaskCompletion(taskId, 'video completed');

            setPollingTasks(prev => {
              const newSet = new Set(prev);
              newSet.delete(taskId);
              return newSet;
            });
            return; // Stop polling
          } else if (taskResult.status === 'failed') {
            console.log(`Polling stopped for task ${taskId}: status = failed`);
            
            // Handle task completion
            handleTaskCompletion(taskId, 'video generation failed');
            
            setPollingTasks(prev => {
              const newSet = new Set(prev);
              newSet.delete(taskId);
              return newSet;
            });
            return; // Stop polling
          }
        } else if (result.data?.ResponseMetadata?.Error) {
          // Handle API errors gracefully
          console.log('Status check API error:', result.data.ResponseMetadata.Error);
          updateVideoTasks(prev => prev.map(task => 
            task.taskId === taskId ? {
              ...task,
              status: 'processing',
              error: 'Status check unavailable - video may still be processing'
            } : task
          ));
          setPollingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
          return; // Stop polling due to API error
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          // Timeout
          console.log(`Polling timeout for task ${taskId}`);
          updateVideoTasks(prev => prev.map(task => 
            task.taskId === taskId ? {
              ...task,
              status: 'processing',
              error: 'Status check timeout - please check JIMeng console manually'
            } : task
          ));
          setPollingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }
      } catch (error) {
        console.error('Error polling task status:', error);
        updateVideoTasks(prev => prev.map(task => 
          task.taskId === taskId ? {
            ...task,
            status: 'processing',
            error: 'Status check failed - please check JIMeng console manually'
          } : task
        ));
        setPollingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    };

    poll();
  };

  const processNextQueuedImage = async () => {
    // This function is no longer needed since we process all images simultaneously
    console.log('🔄 processNextQueuedImage called - but queuing is disabled, all images are processed at once');
    return;
  };

  // Helper function to update video tasks
  const updateVideoTasks = (updater: (tasks: VideoGenerationTask[]) => VideoGenerationTask[], currentTasks?: VideoGenerationTask[]) => {
    // Use provided currentTasks, or the ref (which should be current), or fall back to session state
    const tasksToUpdate = currentTasks || currentVideoTasksRef.current || videoTasks;
    
    // If we have no tasks to update, don't proceed (this prevents clearing all tasks)
    if (tasksToUpdate.length === 0) {
      console.log('⚠️ updateVideoTasks called with no tasks - skipping to prevent data loss');
      return;
    }
    
    const newTasks = updater(tasksToUpdate);
    console.log('🔄 updateVideoTasks called:', {
      currentTasksCount: tasksToUpdate.length,
      newTasksCount: newTasks.length,
      sessionId: currentSession?.id,
      currentTasksDetails: tasksToUpdate.map(t => ({ imageName: t.imageName, status: t.status, taskId: t.taskId })),
      newTasksDetails: newTasks.map(t => ({ imageName: t.imageName, status: t.status, taskId: t.taskId })),
      usedProvidedTasks: !!currentTasks,
      usedRef: !currentTasks && tasksToUpdate === currentVideoTasksRef.current
    });
    
    // Update both the session and the ref
    updateSession({ videoTasks: newTasks });
    currentVideoTasksRef.current = newTasks;
  };

  const handleVideoClick = (video: VideoGenerationTask) => {
    console.log('🎬 Video clicked:', video.taskId, video.imageName);
    console.log('🎬 Video details:', {
      taskId: video.taskId,
      imageName: video.imageName,
      status: video.status,
      videoUrl: video.videoUrl,
      previewUrl: video.previewUrl,
      hasValidId: !!(video.taskId)
    });
    
    const videoId = video.taskId || '';
    const newSelected = new Set(selectedVideos);
    
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
      console.log('🔵 Video deselected:', videoId);
    } else {
      newSelected.add(videoId);
      console.log('🟢 Video selected:', videoId);
    }
    
    console.log('🎬 Selection state:', {
      previousCount: selectedVideos.size,
      newCount: newSelected.size,
      selectedIds: Array.from(newSelected),
      allVideoIds: videoTasks.map(t => t.taskId)
    });
    
    setSelectedVideos(newSelected);
  };

  const handleVideoDoubleClick = (video: VideoGenerationTask) => {
    console.log('🎬 Video double-clicked:', video.taskId, video.imageName);
    setPreviewVideo(video);
  };

  const closeVideoPreview = () => {
    setPreviewVideo(null);
  };

  const deleteSelectedVideos = async () => {
    if (selectedVideos.size === 0) {
      alert('Please select videos to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedVideos.size} selected video(s) and their corresponding images?`)) {
      return;
    }

    const selectedTasks = videoTasks.filter(task => selectedVideos.has(task.taskId || ''));
    
    try {
      // Delete videos from server
      const response = await fetch('/api/delete-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: selectedTasks.map(task => ({
            taskId: task.taskId,
            localPath: task.localPath,
            relativePath: task.relativePath,
            previewUrl: task.previewUrl
          }))
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Remove deleted videos from tasks and clean up corresponding images
        const remainingTasks = videoTasks.filter(task => !selectedVideos.has(task.taskId || ''));
        const remainingImages = addedImages.filter(image => 
          !selectedTasks.some(task => task.imageName === image.filename)
        );

        updateSession({ 
          videoTasks: remainingTasks,
          addedImages: remainingImages 
        });
        
        setSelectedVideos(new Set());
        alert(`Successfully deleted ${selectedTasks.length} videos and their corresponding images`);
      } else {
        alert(`Failed to delete videos: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting videos:', error);
      alert('Error deleting videos');
    }
  };

  const deleteIndividualVideo = async (video: VideoGenerationTask) => {
    if (!confirm(`Are you sure you want to delete this video and its corresponding image?`)) {
      return;
    }

    console.log('🗑️ Deleting individual video:', video.taskId, video.imageName);
    
    try {
      // Delete video from server
      const response = await fetch('/api/delete-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: [{
            taskId: video.taskId,
            localPath: video.localPath,
            relativePath: video.relativePath,
            previewUrl: video.previewUrl
          }]
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Remove deleted video from tasks and clean up corresponding image
        const remainingTasks = videoTasks.filter(task => task.taskId !== video.taskId);
        const remainingImages = addedImages.filter(image => image.filename !== video.imageName);

        console.log('🗑️ Updating session after individual delete:', {
          originalVideoTasks: videoTasks.length,
          remainingTasks: remainingTasks.length,
          originalImages: addedImages.length,
          remainingImages: remainingImages.length
        });

        updateSession({ 
          videoTasks: remainingTasks,
          addedImages: remainingImages 
        });
        
        // Clear selection if this video was selected
        if (selectedVideos.has(video.taskId || '')) {
          const newSelected = new Set(selectedVideos);
          newSelected.delete(video.taskId || '');
          setSelectedVideos(newSelected);
        }
        
        console.log('🗑️ Individual video deletion completed');
      } else {
        alert(`Failed to delete video: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting individual video:', error);
      alert('Error deleting video');
    }
  };

  const cancelVideoGeneration = async (taskId: string) => {
    if (!taskId) return;

    if (!confirm('Are you sure you want to cancel this video generation?')) {
      return;
    }

    try {
      const response = await fetch('/api/jimeng-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });

      const result = await response.json();
      if (result.success) {
        // Update task status to cancelled
        updateVideoTasks(prev => prev.map(task => 
          task.taskId === taskId ? {
            ...task,
            status: 'failed',
            error: 'Cancelled by user'
          } : task
        ));

        // Stop polling for this task
        setPollingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });

        // Handle task completion to free up slots
        handleTaskCompletion(taskId, 'cancelled by user');

        console.log(`Successfully cancelled video generation: ${taskId}`);
      } else {
        alert(`Failed to cancel video generation: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cancelling video generation:', error);
      alert('Error cancelling video generation');
    }
  };

  const cancelAllActiveGenerations = async () => {
    const activeTasks = videoTasks.filter(task => 
      task.status === 'submitted' || task.status === 'processing'
    );

    if (activeTasks.length === 0) {
      alert('No active video generations to cancel');
      return;
    }

    if (!confirm(`Are you sure you want to cancel all ${activeTasks.length} active video generation(s)?`)) {
      return;
    }

    for (const task of activeTasks) {
      if (task.taskId) {
        await cancelVideoGeneration(task.taskId);
      }
    }
  };

  // Loading screen while project or session is loading
  if (productLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{dict.common.loading} {productLoading ? dict.projectPage.loadingProject : dict.projectPage.loadingSession}</p>
        </div>
      </div>
    );
  }

  // Error screen if project or session failed to load
  if (!product || !currentSession) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{dict.projectPage.failedToLoad} {!product ? 'project' : 'session'}</p>
          <button
            onClick={() => router.push(`/${locale}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
          >
            {dict.navigation.backToProjects}
          </button>
          {!currentSession && (
            <button
              onClick={handleNewSession}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              {dict.projectPage.createNewSession}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${locale}`)}
                className="text-gray-600 hover:text-gray-900 flex items-center space-x-2"
              >
                <span>←</span>
                <span>{dict.navigation.backToProjects}</span>
              </button>
              <div className="border-l h-6 border-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
                <p className="text-sm text-gray-600">{dict.homepage.projectCard.style} {product.style}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher currentLocale={locale} dict={dict} />
              <div className="text-sm text-gray-500">
                {dict.projectPage.session} {currentSession.name}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Session Sidebar */}
        <SessionSidebar
          projectId={productId}
          currentSessionId={currentSession.id}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          dict={dict}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 min-h-full">
          {/* Left Half - Prompt Generator */}
          <div className="flex-1 py-8 px-4">
            <div className="max-w-4xl mx-auto h-full">
              {/* Header */}
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">
                  {dict.projectPage.promptGenerator.title}
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  {dict.projectPage.promptGenerator.subtitle}
                </p>
              </div>

              {/* Main Content */}
              <div className="space-y-8">
                {/* File Upload Section */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                    {dict.projectPage.promptGenerator.step1}
                  </h2>
                  <FileUpload 
                    onImageExtracted={handleImageExtracted} 
                    onReset={handleImageReset}
                    imageDataUrl={imageDataUrl}
                    dict={dict}
                    onRatioResolutionChange={handleRatioResolutionChange}
                    selectedAspectRatio={imageAspectRatio}
                    selectedResolution={imageResolution}
                  />
                </div>

                {/* Prompt Generation Section */}
                {imageDataUrl && (
                  <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                      {dict.projectPage.promptGenerator.step2}
                    </h2>
                    <PromptGenerator 
                      imageDataUrl={imageDataUrl}
                      selectedImages={selectedImages}
                      setSelectedImages={setSelectedImages}
                      addedImages={addedImages}
                      onAddImages={addSelectedImages}
                      onClearAll={clearAll}
                      onImageDoubleClick={handleImageDoubleClick}
                      prompts={prompts}
                      conversation={conversation}
                      userRequirement={userRequirement}
                      referenceImages={referenceImages}
                      onReferenceImagesChange={setReferenceImages}
                      updatePromptSession={updatePromptSession}
                      projectStyle={product?.style}
                      dict={dict}
                      imageAspectRatio={imageAspectRatio}
                      imageResolution={imageResolution}
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-16 text-center text-gray-500 text-sm">
                <p>
                  {dict.projectPage.promptGenerator.footer}
                </p>
              </div>
            </div>
          </div>

          {/* Right Half - Video Generation */}
          <div className="flex-1 bg-gray-50 border-l border-gray-200 min-h-full">
            <div className="p-6 h-full">
              <div className="bg-white rounded-xl shadow-lg p-6 h-full overflow-y-auto">
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
                  {dict.projectPage.videoGeneration.title.replace('{count}', addedImages.length.toString())}
                </h3>
                
                {/* Video Generation Controls */}
                {addedImages.length > 0 && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-md font-semibold text-gray-700 mb-3">{dict.projectPage.videoGeneration.settings}</h4>
                    
                    {/* Video Prompt Input */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {dict.projectPage.videoGeneration.videoPrompt}
                      </label>
                      <textarea
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        placeholder={dict.projectPage.videoGeneration.videoPromptPlaceholder}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                        maxLength={150}
                      />
                      <p className="text-xs text-gray-400 mt-1">{videoPrompt.length}/150 characters</p>
                    </div>

                    {/* Folder Name Input */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {dict.projectPage.videoGeneration.folderName}
                      </label>
                      <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        placeholder={dict.projectPage.videoGeneration.folderNamePlaceholder}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 {dict.projectPage.videoGeneration.folderNameTip}
                      </p>
                    </div>

                    {/* Auto-detected Aspect Ratio Display (Read-only) */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {dict.projectPage.videoGeneration.aspectRatio} ({dict.projectPage.videoGeneration.autoDetected || 'Auto-detected'})
                      </label>
                      <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                        {dict.aspectRatios[aspectRatio] || `${aspectRatio} (Custom)`}
                        {process.env.NODE_ENV === 'development' && (
                          <span className="text-xs text-gray-400 ml-2">
                            [Debug: aspectRatio="{aspectRatio}", imageAspectRatio="{imageAspectRatio}"]
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {dict.projectPage.videoGeneration.aspectRatioTip || 'Aspect ratio is automatically matched from your uploaded image.'}
                      </p>
                      {process.env.NODE_ENV === 'development' && imageDataUrl && (
                        <p className="text-xs text-gray-400 mt-1">
                          Debug: Image uploaded = {imageDataUrl ? 'Yes' : 'No'}, 
                          Video AR = {aspectRatio}, 
                          Image AR = {imageAspectRatio}
                        </p>
                      )}
                    </div>
                    
                    {/* Generate Video Button */}
                    <button
                      onClick={generateVideos}
                      disabled={isApiChannelOccupied || isGeneratingVideo || !videoPrompt.trim() || !folderName.trim()}
                      className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium mb-3"
                    >
                      {isApiChannelOccupied ? 
                        'Processing Videos...' :
                        isGeneratingVideo ? 
                        dict.projectPage.videoGeneration.settingUp.replace('{count}', addedImages.length.toString()) : 
                        dict.projectPage.videoGeneration.generateButton.replace('{count}', addedImages.length.toString()).replace('{plural}', addedImages.length > 1 ? 's' : '')
                      }
                    </button>

                    {/* Cancel All Button - Show when there are active generations */}
                    {videoTasks.some(task => task.status === 'submitted' || task.status === 'processing') && (
                      <button
                        onClick={cancelAllActiveGenerations}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        Cancel All Active Generations ({videoTasks.filter(task => task.status === 'submitted' || task.status === 'processing').length})
                      </button>
                    )}

                    {/* DEBUG: Test Session Persistence */}
                    {process.env.NODE_ENV === 'development' && videoTasks.length > 0 && (
                      <button
                        onClick={() => {
                          console.log('🧪 DEBUG: Testing session persistence...');
                          const testRemaining = videoTasks.slice(0, -1); // Remove last video task
                          console.log('🧪 Removing last video task, remaining:', testRemaining.length);
                          updateSession({ videoTasks: testRemaining });
                          setTimeout(() => {
                            console.log('🧪 Session check after 2 seconds:', {
                              videoTasksCount: videoTasks.length,
                              currentSessionVideoTasks: currentSession?.videoTasks?.length
                            });
                          }, 2000);
                        }}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium mt-2"
                      >
                        🧪 DEBUG: Test Remove Last Video
                      </button>
                    )}
                  </div>
                )}
                
                {/* Images Section */}
                <div className="mt-6">
                  <h4 className="text-md font-semibold text-gray-700 mb-4">{dict.projectPage.videoGeneration.selectedImages}</h4>
                  
                  {addedImages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">{dict.projectPage.videoGeneration.noImages}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {addedImages.map((image, index) => (
                        <div key={image.taskId} className="relative group">
                          <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500">
                            <img
                              src={image.url}
                              alt={`Added image ${index + 1}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onDoubleClick={() => handleImageDoubleClick(image)}
                            />
                            {/* Tick mark */}
                            <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            {/* Remove button */}
                            <button
                              onClick={() => removeFromAdded(image.taskId)}
                              className="absolute top-1 left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">{image.filename}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clear all added images button */}
                  {addedImages.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setAddedImages([])}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        {dict.projectPage.videoGeneration.clearAllImages}
                      </button>
                    </div>
                  )}
                </div>

                {/* Video Tasks Display */}
                {videoTasks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h4 className="text-md font-semibold text-gray-700 mb-4">Video Generation Progress</h4>
                    
                    {/* Completed Videos with Previews */}
                    {videoTasks.some(task => task.status === 'downloaded' && (task.videoUrl || task.previewUrl)) && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-medium text-gray-700">
                            Generated Videos ({videoTasks.filter(task => task.status === 'downloaded' && (task.videoUrl || task.previewUrl)).length})
                          </h5>
                          {selectedVideos.size > 0 && (
                            <div className="flex gap-2">
                              <MaterialSubmissionButton
                                videoTasks={videoTasks.filter(task => {
                                  const isSelected = selectedVideos.has(task.taskId || '');
                                  const isDownloaded = task.status === 'downloaded';
                                  const hasVideo = !!(task.videoUrl || task.previewUrl);
                                  
                                  console.log(`🎬 Material submission filter for ${task.imageName}:`, {
                                    taskId: task.taskId,
                                    isSelected,
                                    isDownloaded,
                                    hasVideo,
                                    status: task.status,
                                    videoUrl: task.videoUrl,
                                    previewUrl: task.previewUrl,
                                    willInclude: isSelected && isDownloaded && hasVideo
                                  });
                                  
                                  return isSelected && isDownloaded && hasVideo;
                                })}
                                productId={parseInt(productId)}
                                productName={product?.name || 'Unknown Product'}
                                folderName={folderName}
                                onSubmissionComplete={(results) => {
                                  console.log('Material submission completed:', results);
                                  // Clear selected videos after successful submission
                                  setSelectedVideos(new Set());
                                  
                                  // Optional: Show success message
                                  const successCount = results.filter(r => r.success).length;
                                  if (successCount > 0) {
                                    alert(`Successfully submitted ${successCount} videos as materials!`);
                                  }
                                }}
                                onSubmissionError={(error) => {
                                  console.error('Material submission error:', error);
                                  alert(`Material submission failed: ${error}`);
                                }}
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Video Preview Grid */}
                        <div className="grid grid-cols-3 gap-3">
                          {videoTasks
                            .filter(task => task.status === 'downloaded' && (task.videoUrl || task.previewUrl))
                            .map((video, index) => {
                              const isSelected = selectedVideos.has(video.taskId || '');
                              
                              // Always use original source image as preview (simpler and more reliable)
                              const originalImage = addedImages.find(img => img.filename === video.imageName);
                              
                              console.log(`🖼️ Video preview debug for ${video.imageName}:`, {
                                taskId: video.taskId,
                                videoUrl: video.videoUrl,
                                previewUrl: video.previewUrl,
                                originalImageUrl: originalImage?.url,
                                usingOriginalAsPreview: true
                              });
                              
                              return (
                                <div key={video.taskId || index} className="relative group">
                                  <div 
                                    className={`relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                                      isSelected ? 'border-blue-500' : 'border-transparent'
                                    }`}
                                    onClick={() => handleVideoClick(video)}
                                  >
                                    {/* Always use image preview (original source image) */}
                                    <img
                                      src={video.previewUrl || originalImage?.url || ''}
                                      alt={`Video preview ${index + 1}`}
                                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                                      onError={(e) => {
                                        console.error('Image preview failed to load:', video.previewUrl);
                                        // Fallback to original image if preview URL fails
                                        if (originalImage?.url && video.previewUrl !== originalImage.url) {
                                          console.log('Trying original image as fallback');
                                          (e.target as HTMLImageElement).src = originalImage.url;
                                        } else {
                                          console.error('No fallback image available for:', video.imageName);
                                          // Show placeholder or error state
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          const placeholder = document.createElement('div');
                                          placeholder.className = 'w-full h-full bg-gray-300 flex items-center justify-center text-gray-500 text-xs';
                                          placeholder.textContent = 'Image unavailable';
                                          e.currentTarget.appendChild(placeholder);
                                        }
                                      }}
                                    />
                                    
                                    {/* Video Play Icon Overlay - Only covers the center button */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                      <div 
                                        className="w-12 h-12 bg-black bg-opacity-50 rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all duration-200 cursor-pointer pointer-events-auto"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent triggering video selection
                                          handleVideoDoubleClick(video); // Open video preview modal
                                        }}
                                      >
                                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </div>
                                    
                                    {/* Preview type indicator */}
                                    <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black bg-opacity-50 rounded text-xs text-white">
                                      Original
                                    </div>
                                    
                                    {/* Selection indicator */}
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center pointer-events-none">
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                    
                                    {/* Delete button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent triggering video click
                                        deleteIndividualVideo(video);
                                      }}
                                      className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                                      title="Delete video and corresponding image"
                                    >
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 truncate">{video.imageName}</p>
                                </div>
                              );
                            })}
                        </div>

                        <div className="text-xs text-gray-500 mt-3">
                          💡 Single click to select, click play button (▶️) to view full video, hover to see delete button (🗑️)
                          <br />
                          🎬 Preview: Always shows original source image used to generate the video (reliable & consistent)
                          <br />
                          📋 Selected: {selectedVideos.size} video(s) ready for material submission
                        </div>
                      </div>
                    )}

                    {/* Processing Videos Status */}
                    {videoTasks.some(task => task.status !== 'downloaded') && (
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-gray-700">Processing Status</h5>
                        {videoTasks
                          .filter(task => task.status !== 'downloaded')
                          .map((task, index) => (
                          <div key={`${task.taskId || task.imageIndex}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center space-x-3">
                              {/* Status Icon */}
                              <div className="flex-shrink-0">
                                {task.status === 'submitted' && (
                                  <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-white"></div>
                                  </div>
                                )}
                                {task.status === 'processing' && (
                                  <div className="w-4 h-4 rounded-full bg-yellow-500 animate-spin border-2 border-white border-t-transparent"></div>
                                )}
                                {task.status === 'completed' && (
                                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                {task.status === 'downloading' && (
                                  <div className="w-4 h-4 rounded-full bg-purple-500 animate-pulse flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                {task.status === 'failed' && (
                                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              
                              {/* Task Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {task.imageName}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {task.status === 'submitted' && 'Submitted to API'}
                                  {task.status === 'processing' && 'Generating video...'}
                                  {task.status === 'completed' && 'Video ready'}
                                  {task.status === 'downloading' && 'Downloading...'}
                                  {task.status === 'failed' && 'Generation failed'}
                                </p>
                                {task.error && (
                                  <p className="text-xs text-red-500 mt-1 truncate" title={task.error}>
                                    Error: {task.error}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Action Button */}
                            <div className="flex-shrink-0">
                              {task.status === 'completed' && task.videoUrl && (
                                <a
                                  href={task.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition-colors"
                                >
                                  Open
                                </a>
                              )}
                              {(task.status === 'submitted' || task.status === 'processing') && task.taskId && (
                                <div className="flex gap-1">
                                  <span className="text-xs text-gray-500">
                                    ID: {task.taskId.substring(0, 8)}...
                                  </span>
                                  <button
                                    onClick={() => cancelVideoGeneration(task.taskId!)}
                                    className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors"
                                    title="Cancel this video generation"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Summary */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-800">
                        <div className="flex justify-between items-center">
                          <span>
                            Progress: {videoTasks.filter(t => t.status === 'downloaded').length} / {videoTasks.length} completed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={closePreview}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200"
            >
              ✕
            </button>
            <div className="relative w-full h-full">
              <img
                src={previewImage.url}
                alt="Preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
            <div className="text-center mt-4 text-white">
              <p className="text-sm opacity-75">{previewImage.filename}</p>
              <p className="text-xs opacity-50 mt-1 max-w-2xl mx-auto">"{previewImage.prompt}"</p>
            </div>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl max-h-full">
            <button
              onClick={closeVideoPreview}
              className="absolute top-4 right-4 z-20 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200"
            >
              ✕
            </button>
            <div className="relative w-full h-full">
              {previewVideo.videoUrl ? (
                <video
                  src={previewVideo.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              ) : previewVideo.relativePath ? (
                <video
                  src={`/${previewVideo.relativePath}`}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="text-white text-center p-8">
                  <p>Video not available</p>
                </div>
              )}
            </div>
            <div className="text-center mt-4 text-white">
              <p className="text-sm opacity-75">{previewVideo.imageName}</p>
              <p className="text-xs opacity-50 mt-1">Generated Video</p>
              {previewVideo.videoUrl && (
                <a
                  href={previewVideo.videoUrl}
                  download={`${previewVideo.imageName}.mp4`}
                  className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Download Video
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 