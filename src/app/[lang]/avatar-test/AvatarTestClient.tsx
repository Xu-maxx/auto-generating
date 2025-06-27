'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { AvatarSessionManager, AvatarSessionData, AvatarAsset, AvatarGroup } from '@/utils/avatarSessionManager';

interface AvatarTestClientProps {
  dict: any;
}

interface GeneratedAvatar {
  id: string;
  filename: string;
  url: string;
  prompt: string;
  taskId: string;
}

interface ExistingImage {
  id: string;
  url: string;
  filename: string;
  selected: boolean;
}

interface AvatarPrompt {
  id: number;
  content: string;
  runwayPrompt: string;
  chineseTranslation: string;
  isEdited: boolean;
  specification?: string;
  generatedImages: GeneratedAvatar[];
  isGeneratingImages: boolean;
  failedCount: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  editedContent?: string;
}

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_audio: string;
}

interface GeneratedVideo {
  id: string;
  videoId: string;
  status: string;
  videoUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  assetId: string;
  voiceId: string;
  text: string;
  createdAt: string;
  videoData?: any; // Store full video data from HeyGen
}

export default function AvatarTestClient({ dict }: AvatarTestClientProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'generate'>('existing');
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [selectedAvatars, setSelectedAvatars] = useState<(ExistingImage | GeneratedAvatar)[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [avatarDescription, setAvatarDescription] = useState('');
  const [userRequirement, setUserRequirement] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [avatarPrompts, setAvatarPrompts] = useState<AvatarPrompt[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [successNotification, setSuccessNotification] = useState<string>('');
  const [avatarSession, setAvatarSession] = useState<AvatarSessionData | null>(null);
  
  // Video generation states
  const [voices, setVoices] = useState<Voice[]>([]);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<string>('');
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [videoText, setVideoText] = useState('hello world my name is Amy how are you I am fine thank you');
  
  // Motion states
  const [isAddingMotion, setIsAddingMotion] = useState(false);
  const [motionStatus, setMotionStatus] = useState<string>('');
  
  // Status checking intervals
  const [statusCheckIntervals, setStatusCheckIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load existing images from the generated-images directory
  const loadExistingImages = async () => {
    try {
      const response = await fetch('/api/list-existing-images');
      const data = await response.json();
      
      if (data.success) {
        setExistingImages(data.images || []);
      } else {
        console.error('Failed to load existing images:', data.error);
      }
    } catch (error) {
      console.error('Error loading existing images:', error);
    }
  };

  // Handle file upload for new images
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: ExistingImage[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = URL.createObjectURL(file);
      
      const newImage: ExistingImage = {
        id: `uploaded_${Date.now()}_${i}`,
        url: imageUrl,
        filename: file.name,
        selected: false
      };
      
      newImages.push(newImage);
    }
    
    setExistingImages(prev => [...prev, ...newImages]);
  };

  // Select an existing image as avatar (toggle selection)
  const selectExistingImage = (image: ExistingImage) => {
    const isSelected = selectedAvatars.some(avatar => avatar.id === image.id);
    
    if (isSelected) {
      // Remove from selection
      setSelectedAvatars(prev => prev.filter(avatar => avatar.id !== image.id));
      const updatedImages = existingImages.map(img => ({
        ...img,
        selected: img.id === image.id ? false : img.selected
      }));
      setExistingImages(updatedImages);
    } else {
      // Add to selection
      setSelectedAvatars(prev => [...prev, image]);
      const updatedImages = existingImages.map(img => ({
        ...img,
        selected: img.id === image.id ? true : img.selected
      }));
      setExistingImages(updatedImages);
    }
  };

  // Generate/optimize prompt using ChatGPT
  const generatePrompt = async () => {
    if (!avatarDescription.trim() && conversation.length === 0) return;
    
    setIsOptimizing(true);
    setError(null);
    
    try {
      let messages;
      
      if (conversation.length === 0) {
        // First time - initial description
        messages = [
          {
            role: 'system',
            content: `You are an expert prompt engineer for AI image generation, specifically for creating avatars and portraits. Your task is to transform a simple description into a detailed, optimized prompt that will generate high-quality avatar images.

Guidelines for avatar prompts:
1. Focus on facial features, expression, and upper body/portrait composition
2. Include lighting details (soft lighting, studio lighting, natural lighting)
3. Specify image quality terms (high resolution, detailed, professional)
4. Include appropriate background (simple, blurred, studio, neutral)
5. Mention camera/photography terms for realism (portrait photography, headshot)
6. Avoid overly complex scenes - focus on the person
7. Include style references if appropriate (photorealistic, professional headshot, etc.)

Transform the user's description into a comprehensive prompt that will generate an excellent avatar image. You need to output the response in the following structure:

**RUNWAY PROMPT:**
[The runway prompt in English]

**CHINESE TRANSLATION:**
[The Chinese translation of the runway prompt]

Make sure to follow this exact format with the headers and structure.`
          },
          {
            role: 'user',
            content: avatarDescription
          }
        ];
      } else {
        // Subsequent conversations - include history
        messages = [
          ...conversation.slice(0, 2), // Keep system and first user message
          ...conversation.slice(2).map(msg => ({
            ...msg,
            content: msg.role === 'assistant' && msg.editedContent ? msg.editedContent : msg.content
          })),
          {
            role: 'user',
            content: userRequirement.trim() 
              ? `Please provide another avatar prompt variation. ${userRequirement.trim()}. Make sure to follow the exact output format with **RUNWAY PROMPT:** and **CHINESE TRANSLATION:** sections.`
              : 'Please provide another avatar prompt variation, make it different from the previous ones but still focused on creating an excellent avatar. Make sure to follow the exact output format with **RUNWAY PROMPT:** and **CHINESE TRANSLATION:** sections.'
          }
        ];
      }

      const response = await fetch('/api/optimize-avatar-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          userRequirement: userRequirement
        }),
      });

      if (!response.ok) throw new Error('Failed to generate prompt');
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const newPrompt: AvatarPrompt = {
        id: Date.now(),
        content: data.fullResponse,
        runwayPrompt: data.optimizedPrompt,
        chineseTranslation: data.chineseTranslation,
        isEdited: false,
        specification: userRequirement.trim() || undefined,
        generatedImages: [],
        isGeneratingImages: false,
        failedCount: 0
      };

      // Add new conversation messages
      let newConversation;
      if (conversation.length === 0) {
        newConversation = [
          {
            role: 'system' as const,
            content: `You are an expert prompt engineer for AI image generation, specifically for creating avatars and portraits.`
          },
          {
            role: 'user' as const,
            content: avatarDescription
          },
          {
            role: 'assistant' as const,
            content: data.fullResponse
          }
        ];
      } else {
        newConversation = [
          ...conversation,
          {
            role: 'user' as const,
            content: userRequirement.trim() || 'Generate another avatar prompt variation'
          },
          {
            role: 'assistant' as const,
            content: data.fullResponse
          }
        ];
      }

      setAvatarPrompts([...avatarPrompts, newPrompt]);
      setConversation(newConversation);
      setUserRequirement(''); // Clear user requirement after successful generation
      
    } catch (error) {
      console.error('Error generating prompt:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle prompt editing
  const handlePromptEdit = (id: number, newRunwayPrompt: string) => {
    const updatedPrompts = avatarPrompts.map(prompt => 
      prompt.id === id 
        ? { ...prompt, runwayPrompt: newRunwayPrompt, isEdited: true }
        : prompt
    );
    setAvatarPrompts(updatedPrompts);
  };

  // Generate avatars from prompt
  const generateAvatars = async (promptId: number, imageCount: number) => {
    const prompt = avatarPrompts.find(p => p.id === promptId);
    if (!prompt || prompt.isGeneratingImages) return;

    // Update prompt state to show generating
    const updatedPrompts = avatarPrompts.map(p => 
      p.id === promptId 
        ? { ...p, isGeneratingImages: true }
        : p
    );
    setAvatarPrompts(updatedPrompts);

    try {
      const response = await fetch('/api/runway-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: prompt.runwayPrompt,
          imageCount: imageCount,
          referenceImages: [],
          aspectRatio: '1:1', // Square for avatars
          resolution: { width: 1024, height: 1024 }
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate avatars');
      }

      if (data.success && data.images) {
        const newAvatars: GeneratedAvatar[] = data.images.map((img: any) => ({
          id: `generated_${img.taskId}`,
          filename: img.filename,
          url: img.url,
          prompt: prompt.runwayPrompt,
          taskId: img.taskId
        }));
        
        // Update prompt with new images
        const finalUpdatedPrompts = avatarPrompts.map(p => 
          p.id === promptId 
            ? { 
                ...p, 
                generatedImages: [...(p.generatedImages || []), ...newAvatars],
                isGeneratingImages: false,
                failedCount: (p.failedCount || 0) + (data.requested - data.totalGenerated || 0)
              }
            : p
        );
        setAvatarPrompts(finalUpdatedPrompts);
      } else {
        throw new Error(data.error || 'No avatars generated');
      }
    } catch (error) {
      console.error('Error generating avatars:', error);
      // Update state to stop generating
      const errorUpdatedPrompts = avatarPrompts.map(p => 
        p.id === promptId 
          ? { ...p, isGeneratingImages: false, failedCount: (p.failedCount || 0) + imageCount }
          : p
      );
      setAvatarPrompts(errorUpdatedPrompts);
    }
  };

  // Select a generated avatar (toggle selection)
  const selectGeneratedAvatar = (avatar: GeneratedAvatar) => {
    const isSelected = selectedAvatars.some(selected => selected.id === avatar.id);
    
    if (isSelected) {
      // Remove from selection
      setSelectedAvatars(prev => prev.filter(selected => selected.id !== avatar.id));
    } else {
      // Add to selection
      setSelectedAvatars(prev => [...prev, avatar]);
    }
  };

  // Create avatar video using HeyGen - Batch Upload
  const uploadAvatars = async () => {
    if (selectedAvatars.length === 0 || !avatarSession) return;

    setIsUploading(true);
    setUploadStatus(`Preparing ${selectedAvatars.length} avatar${selectedAvatars.length > 1 ? 's' : ''}...`);
    setError(null);

    try {
      const uploadedAssets: AvatarAsset[] = [];
      let avatarGroup = avatarSession.avatarGroup;

      // Process each selected avatar
      for (let i = 0; i < selectedAvatars.length; i++) {
        const avatar = selectedAvatars[i];
        setUploadStatus(`Processing avatar ${i + 1}/${selectedAvatars.length}: ${avatar.filename || 'Generated Avatar'}`);

        // Step 1: Upload image to HeyGen
        let imageBlob: Blob;
        let contentType = 'image/jpeg'; // Default to JPEG
        
        // Handle different avatar sources
        if (avatar.url.startsWith('blob:')) {
          // For uploaded files, fetch the blob
          const response = await fetch(avatar.url);
          imageBlob = await response.blob();
          contentType = imageBlob.type;
        } else if (avatar.url.startsWith('/generated-images/')) {
          // For generated images, fetch from public directory
          const response = await fetch(avatar.url);
          if (!response.ok) throw new Error('Failed to fetch generated image');
          imageBlob = await response.blob();
          
          // Check actual image format by examining the blob content
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Check magic bytes to determine actual format
          if (uint8Array.length >= 4) {
            // PNG magic bytes: 89 50 4E 47
            if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
              contentType = 'image/png';
            }
            // JPEG magic bytes: FF D8 FF
            else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
              contentType = 'image/jpeg';
            }
            // Fallback to blob type or default
            else {
              contentType = imageBlob.type || 'image/jpeg';
            }
          } else {
            contentType = imageBlob.type || 'image/jpeg';
          }
          
          // Recreate blob with correct content type
          imageBlob = new Blob([arrayBuffer], { type: contentType });
        } else {
          // For external URLs, fetch directly
          const response = await fetch(avatar.url);
          if (!response.ok) throw new Error('Failed to fetch image');
          imageBlob = await response.blob();
          
          // Also check magic bytes for external images
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          if (uint8Array.length >= 4) {
            // PNG magic bytes: 89 50 4E 47
            if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
              contentType = 'image/png';
            }
            // JPEG magic bytes: FF D8 FF
            else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
              contentType = 'image/jpeg';
            } else {
              contentType = imageBlob.type || 'image/jpeg';
            }
          } else {
            contentType = imageBlob.type || 'image/jpeg';
          }
          
          // Recreate blob with correct content type
          imageBlob = new Blob([arrayBuffer], { type: contentType });
        }

        // Validate content type
        if (!['image/jpeg', 'image/png'].includes(contentType)) {
          throw new Error(`Unsupported image type: ${contentType}. Only JPEG and PNG are supported.`);
        }

        console.log('Image details:', {
          filename: avatar.filename,
          contentType,
          blobType: imageBlob.type,
          size: imageBlob.size
        });

        // Create form data for upload
        const formData = new FormData();
        formData.append('file', imageBlob, avatar.filename || 'avatar.jpg');

        // Upload to HeyGen
        const uploadResponse = await fetch('/api/heygen-upload-asset', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image to HeyGen');
        }

        const uploadData = await uploadResponse.json();
        console.log('HeyGen upload result:', uploadData);

        if (!uploadData.success || !uploadData.asset.imageKey) {
          throw new Error('Upload successful but no image key received');
        }

        // Create asset record
        const newAsset: AvatarAsset = {
          id: uploadData.asset.id,
          imageKey: uploadData.asset.imageKey,
          filename: avatar.filename || 'avatar.jpg',
          url: avatar.url,
          contentType: contentType,
          uploadedAt: new Date().toISOString()
        };

        uploadedAssets.push(newAsset);

        // Step 2: Create avatar group or add look
        if (i === 0 && !avatarGroup) {
          // Create new photo avatar group with first image
          setUploadStatus(`Creating new avatar group with ${avatar.filename || 'Generated Avatar'}...`);
          
          const avatarName = avatar.filename?.replace(/\.[^/.]+$/, '') || 'Generated Avatar';
          
          const groupResponse = await fetch('/api/heygen-create-avatar-group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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
          console.log('HeyGen avatar group result:', groupData);

          if (!groupData.success) {
            throw new Error('Avatar group creation failed');
          }

          avatarGroup = groupData.avatarGroup;
        } else if (avatarGroup) {
          // Add look to existing group
          setUploadStatus(`Adding ${avatar.filename || 'Generated Avatar'} to avatar group...`);
          
          const lookName = avatar.filename?.replace(/\.[^/.]+$/, '') || `Look ${uploadedAssets.length}`;
          
          const addLookResponse = await fetch('/api/heygen-add-looks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
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

          const addLookData = await addLookResponse.json();
          console.log('HeyGen add look result:', addLookData);
        }
      }

      // Update session with all new assets
      const updatedSession = {
        ...avatarSession,
        avatarGroup: avatarGroup,
        uploadedAssets: [...avatarSession.uploadedAssets, ...uploadedAssets]
      };

      // Save updated session
      const saveResponse = await fetch('/api/avatar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'save', 
          sessionData: updatedSession 
        })
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        setAvatarSession(saveData.session);
      }

      setUploadStatus(`Successfully uploaded ${selectedAvatars.length} avatar${selectedAvatars.length > 1 ? 's' : ''}!`);
      
      // Show prominent success notification
      const successMessage = avatarGroup 
        ? `🎉 Successfully added ${selectedAvatars.length} new look${selectedAvatars.length > 1 ? 's' : ''} to avatar group!`
        : `🎉 Successfully created avatar group with ${selectedAvatars.length} look${selectedAvatars.length > 1 ? 's' : ''}!`;
      
      setSuccessNotification(successMessage);
      
      // Show detailed success message
      setTimeout(() => {
        if (avatarGroup) {
          setUploadStatus(`✅ Successfully added ${selectedAvatars.length} new look${selectedAvatars.length > 1 ? 's' : ''} to avatar group "${avatarGroup.name}"! Your avatar now has ${(avatarSession.uploadedAssets.length || 0) + uploadedAssets.length} total looks for video generation.`);
        } else {
          setUploadStatus(`✅ Successfully created new avatar group with ${selectedAvatars.length} look${selectedAvatars.length > 1 ? 's' : ''}! Ready for video generation.`);
        }
      }, 1000);
      
      // Clear success notification after 5 seconds
      setTimeout(() => {
        setSuccessNotification('');
      }, 5000);
      
      // Clear selection after successful upload
      setSelectedAvatars([]);
      setExistingImages(prev => prev.map(img => ({ ...img, selected: false })));

    } catch (error) {
      console.error('Error uploading avatars:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setUploadStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  // Utility functions for multiple selection
  const selectAllImages = () => {
    const allImages = [...existingImages];
    setSelectedAvatars(prev => {
      const existingIds = prev.map(avatar => avatar.id);
      const newImages = allImages.filter(img => !existingIds.includes(img.id));
      return [...prev, ...newImages];
    });
    setExistingImages(prev => prev.map(img => ({ ...img, selected: true })));
  };

  const clearSelection = () => {
    setSelectedAvatars([]);
    setExistingImages(prev => prev.map(img => ({ ...img, selected: false })));
  };

  const selectAllGeneratedAvatars = () => {
    const allGenerated = avatarPrompts.flatMap(prompt => prompt.generatedImages);
    setSelectedAvatars(prev => {
      const existingIds = prev.map(avatar => avatar.id);
      const newGenerated = allGenerated.filter(avatar => !existingIds.includes(avatar.id));
      return [...prev, ...newGenerated];
    });
  };

  // Load available voices from HeyGen
  const loadVoices = async () => {
    try {
      const response = await fetch('/api/heygen-list-voices');
      const data = await response.json();
      
      if (data.success) {
        setVoices(data.voices || []);
        console.log('Loaded voices:', data.voices?.length || 0);
      } else {
        console.error('Failed to load voices:', data.error);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  };

  // Add motion to avatars
  const addMotionToAvatars = async () => {
    if (!avatarSession?.uploadedAssets.length || !avatarSession?.avatarGroup) {
      setError('Please upload avatars and create an avatar group first');
      return;
    }

    setIsAddingMotion(true);
    setMotionStatus('Getting avatar details from group...');
    setError(null);

    try {
      // First, get the avatars in the avatar group to get the actual photo avatar IDs
      console.log('Getting avatars from group for motion:', avatarSession.avatarGroup.id);
      
      const avatarsResponse = await fetch(`/api/heygen-list-avatars-in-group?groupId=${avatarSession.avatarGroup.id}`);
      
      if (!avatarsResponse.ok) {
        const errorData = await avatarsResponse.json();
        throw new Error(errorData.error || 'Failed to get avatars from group');
      }

      const avatarsData = await avatarsResponse.json();
      console.log('Avatars in group for motion:', avatarsData);

      if (!avatarsData.success || !avatarsData.avatars || avatarsData.avatars.length === 0) {
        throw new Error('No avatars found in the avatar group');
      }

      const motionResults = [];
      
      // Add motion to each avatar in the group
      for (let i = 0; i < avatarsData.avatars.length; i++) {
        const avatar = avatarsData.avatars[i];
        setMotionStatus(`Adding motion to avatar ${i + 1}/${avatarsData.avatars.length}: ${avatar.name || 'Unknown'}...`);

        console.log('Adding motion to avatar:', {
          avatarId: avatar.id,
          name: avatar.name,
          status: avatar.status
        });

        // Add motion to this avatar
        const motionResponse = await fetch('/api/heygen-add-motion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            avatarId: avatar.id
          }),
        });

        if (!motionResponse.ok) {
          const errorData = await motionResponse.json();
          console.error(`Failed to add motion to avatar ${avatar.id}:`, errorData);
          // Continue with other avatars even if one fails
          motionResults.push({
            originalId: avatar.id,
            name: avatar.name,
            success: false,
            error: errorData.error
          });
          continue;
        }

        const motionData = await motionResponse.json();
        console.log('Motion added successfully:', motionData);

        if (motionData.success && motionData.motionAvatarId) {
          motionResults.push({
            originalId: avatar.id,
            motionAvatarId: motionData.motionAvatarId,
            name: avatar.name,
            success: true
          });

          // Update session with motion information
          try {
            await fetch('/api/avatar-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'addMotion',
                sessionId: avatarSession.id,
                assetId: avatar.id,
                motionAvatarId: motionData.motionAvatarId
              })
            });
          } catch (sessionError) {
            console.error('Failed to update session with motion info:', sessionError);
          }
        } else {
          motionResults.push({
            originalId: avatar.id,
            name: avatar.name,
            success: false,
            error: 'No motion avatar ID received'
          });
        }
      }

      // Update session state
      const updatedSession = {
        ...avatarSession,
        avatarGroup: {
          ...avatarSession.avatarGroup,
          motionEnabled: true
        },
        motionAvatars: motionResults.filter(r => r.success).map(r => r.motionAvatarId)
      };
      setAvatarSession(updatedSession);

      const successCount = motionResults.filter(r => r.success).length;
      const failCount = motionResults.filter(r => !r.success).length;

      if (successCount > 0) {
        setMotionStatus(`✅ Successfully added motion to ${successCount} avatar${successCount > 1 ? 's' : ''}!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        setSuccessNotification(`🎬 Motion added to ${successCount} avatar${successCount > 1 ? 's' : ''}! Your avatars are now ready for dynamic video generation.`);
        
        // Clear success notification after 5 seconds
        setTimeout(() => {
          setSuccessNotification('');
        }, 5000);
      } else {
        throw new Error('Failed to add motion to any avatars');
      }

    } catch (error) {
      console.error('Error adding motion to avatars:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setMotionStatus('');
    } finally {
      setIsAddingMotion(false);
    }
  };

  // Generate video from selected avatar
  const generateVideo = async () => {
    if (!avatarSession?.uploadedAssets.length || !avatarSession?.avatarGroup) {
      setError('Please upload avatars and create an avatar group first before generating video');
      return;
    }

    // Load voices if not already loaded
    if (voices.length === 0) {
      await loadVoices();
    }

    if (voices.length === 0) {
      setError('No voices available');
      return;
    }

    setIsGeneratingVideo(true);
    setVideoGenerationStatus('Getting avatar group details...');
    setError(null);

    try {
      // First, get the avatars in the avatar group to get the actual photo avatar IDs
      console.log('Getting avatars from group:', avatarSession.avatarGroup.id);
      
      const avatarsResponse = await fetch(`/api/heygen-list-avatars-in-group?groupId=${avatarSession.avatarGroup.id}`);
      
      if (!avatarsResponse.ok) {
        const errorData = await avatarsResponse.json();
        throw new Error(errorData.error || 'Failed to get avatars from group');
      }

      const avatarsData = await avatarsResponse.json();
      console.log('Avatars in group:', avatarsData);

      if (!avatarsData.success || !avatarsData.avatars || avatarsData.avatars.length === 0) {
        throw new Error('No avatars found in the avatar group');
      }

      // Use the first avatar from the group
      const firstAvatar = avatarsData.avatars[0];
      let photoAvatarId = firstAvatar.id;

      // If motion is enabled, try to use motion avatar ID instead
      if (avatarSession.avatarGroup.motionEnabled && avatarSession.motionAvatars && avatarSession.motionAvatars.length > 0) {
        // Use the first motion avatar ID
        photoAvatarId = avatarSession.motionAvatars[0];
        console.log('Using motion-enabled avatar for video generation:', photoAvatarId);
        setVideoGenerationStatus('Using motion-enabled avatar for dynamic video generation...');
      } else {
        console.log('Using static avatar for video generation:', photoAvatarId);
        setVideoGenerationStatus('Using static avatar for video generation...');
      }

      if (!photoAvatarId) {
        throw new Error('No valid photo avatar ID found');
      }

      // Select a random voice
      const randomVoice = voices[Math.floor(Math.random() * voices.length)];

      setVideoGenerationStatus('Starting video generation with photo avatar...');

      console.log('Generating video with photo avatar:', {
        photoAvatarId: photoAvatarId,
        avatarName: firstAvatar.name || 'Unknown',
        avatarStatus: firstAvatar.status || 'Unknown',
        voiceId: randomVoice.voice_id,
        voiceName: randomVoice.name,
        text: videoText
      });

      // Generate video
      const response = await fetch('/api/heygen-generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: photoAvatarId, // Use the actual photo avatar ID
          voiceId: randomVoice.voice_id,
          text: videoText,
          title: `Avatar Video - ${firstAvatar.name || 'Photo Avatar'}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate video');
      }

      const data = await response.json();
      console.log('Video generation started:', data);
      console.log('Full response structure:', JSON.stringify(data, null, 2));

      // Extract video ID from nested structure - try multiple possible paths
      let videoId = null;
      
      // Try different possible paths for video ID
      if (data.data?.video_id) {
        videoId = data.data.video_id;
      } else if (data.data?.videoId) {
        videoId = data.data.videoId;
      } else if (data.videoId) {
        videoId = data.videoId;
      } else if (data.video_id) {
        videoId = data.video_id;
      } else if (data.data?.data?.video_id) {
        videoId = data.data.data.video_id;
      } else if (data.data?.id) {
        videoId = data.data.id;
      }
      
      console.log('Extracted video ID:', videoId);
      console.log('Available keys in data:', Object.keys(data));
      console.log('Available keys in data.data:', data.data ? Object.keys(data.data) : 'No data.data');
      
      if (data.success && videoId) {
        const newVideo: GeneratedVideo = {
          id: `video_${Date.now()}`,
          videoId: videoId,
          status: 'processing',
          assetId: photoAvatarId, // Store the photo avatar ID
          voiceId: randomVoice.voice_id,
          text: videoText,
          createdAt: new Date().toISOString()
        };

        setGeneratedVideos(prev => [...prev, newVideo]);
        setVideoGenerationStatus(`Video generation started using photo avatar "${firstAvatar.name || 'Unknown'}"! Video ID: ${videoId}`);

        // Start checking video status with proper interval
        startVideoStatusInterval(videoId);
      } else {
        throw new Error('Video generation failed - no video ID received');
      }

    } catch (error) {
      console.error('Error generating video:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setVideoGenerationStatus('');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Check video generation status with proper interval management
  const checkVideoStatus = async (videoId: string) => {
    try {
      const response = await fetch(`/api/heygen-video-status?videoId=${videoId}`);
      const data = await response.json();

      if (data.success) {
        const status = data.status;
        const videoUrl = data.videoUrl;
        const videoData = data.data;

        console.log(`Video ${videoId} status:`, status);
        console.log(`Video ${videoId} full data:`, videoData);

        // Extract additional video information
        const downloadUrl = videoData?.video_url_https || videoData?.download_url || videoUrl;
        const thumbnailUrl = videoData?.thumbnail_url || videoData?.gif_url;
        const duration = videoData?.duration;

        // Update video in state
        setGeneratedVideos(prev => prev.map(video => 
          video.videoId === videoId 
            ? { 
                ...video, 
                status, 
                videoUrl,
                downloadUrl,
                thumbnailUrl,
                duration,
                videoData
              }
            : video
        ));

        if (status === 'completed' && videoUrl) {
          setVideoGenerationStatus(`✅ Video generation completed! Video is ready for download.`);
          // Clear the interval for this video
          clearVideoStatusInterval(videoId);
        } else if (status === 'processing') {
          setVideoGenerationStatus(`🔄 Video is being processed... (${status})`);
          // Continue checking - interval will handle the next check
        } else if (status === 'failed') {
          setVideoGenerationStatus(`❌ Video generation failed`);
          setError('Video generation failed');
          // Clear the interval for this video
          clearVideoStatusInterval(videoId);
        } else {
          setVideoGenerationStatus(`Status: ${status}`);
          // Continue checking for other statuses
        }
      } else {
        console.error('Failed to check video status:', data.error);
        // Don't clear interval on API errors, might be temporary
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      // Don't clear interval on network errors, might be temporary
    }
  };

  // Start status checking interval for a video
  const startVideoStatusInterval = (videoId: string) => {
    // Clear any existing interval for this video
    clearVideoStatusInterval(videoId);
    
    // Start new interval
    const interval = setInterval(() => {
      checkVideoStatus(videoId);
    }, 10000); // Check every 10 seconds
    
    // Store the interval
    setStatusCheckIntervals(prev => new Map(prev.set(videoId, interval)));
    
    // Also check immediately
    checkVideoStatus(videoId);
  };

  // Clear status checking interval for a specific video
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

  // Clear all status checking intervals
  const clearAllVideoStatusIntervals = () => {
    statusCheckIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    setStatusCheckIntervals(new Map());
  };

  // Cleanup intervals on component unmount
  useEffect(() => {
    return () => {
      clearAllVideoStatusIntervals();
    };
  }, []);

  // Load voices on component mount
  useEffect(() => {
    loadVoices();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Avatar Video Creator - Testing</h1>
        <p className="text-gray-600 text-center">Choose multiple existing images or generate new avatars for video creation</p>
        
        {/* Session Info Panel */}
        {avatarSession && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-800">Avatar Session Active</h3>
                <p className="text-sm text-blue-600">
                  {avatarSession.avatarGroup 
                    ? `Group: ${avatarSession.avatarGroup.name} (${avatarSession.uploadedAssets.length} assets)`
                    : `Session: ${avatarSession.id.split('-')[0]}... (${avatarSession.uploadedAssets.length} assets)`
                  }
                </p>
              </div>
              <div className="text-xs text-blue-500">
                {avatarSession.avatarGroup ? 'Ready for new looks' : 'Ready to create group'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {successNotification && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {successNotification}
              </p>
            </div>
          </div>
        </div>
      )}

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
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Choose from Existing Images</h2>
            
            {/* Upload New Images */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Upload Images
                </button>
                <button
                  onClick={loadExistingImages}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Load Existing Images
                </button>
              </div>
              
              {/* Selection Controls */}
              {existingImages.length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedAvatars.filter(avatar => existingImages.some(img => img.id === avatar.id)).length} of {existingImages.length} selected
                  </span>
                  <button
                    onClick={selectAllImages}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Images Grid */}
            {existingImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {existingImages.map((image) => (
                  <div
                    key={image.id}
                    onClick={() => selectExistingImage(image)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      image.selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square">
                      <Image
                        src={image.url}
                        alt={image.filename}
                        width={150}
                        height={150}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {image.selected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="p-2 bg-white">
                      <p className="text-xs text-gray-600 truncate">{image.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No images available. Upload some images or load existing ones.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Generate New Avatar</h2>
            
            {/* Description Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Describe your desired avatar:
                </label>
                <textarea
                  value={avatarDescription}
                  onChange={(e) => setAvatarDescription(e.target.value)}
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., A professional woman in her 30s with short brown hair, wearing a business suit..."
                />
              </div>

              {/* User Requirement for Variations */}
              {avatarPrompts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specify Changes for Next Variation:
                  </label>
                  <textarea
                    value={userRequirement}
                    onChange={(e) => setUserRequirement(e.target.value)}
                    className="w-full h-20 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Describe what you want to change or improve in the next variation..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Leave empty for a general variation, or describe specific changes you want
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={generatePrompt}
                  disabled={(!avatarDescription.trim() && conversation.length === 0) || isOptimizing}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isOptimizing ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Generating...</span>
                    </div>
                  ) : (
                    avatarPrompts.length === 0 ? 'Generate Avatar Prompt' : 'Generate Another Variation'
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">⚠️ {error}</p>
                </div>
              )}
            </div>

            {/* Generated Avatar Prompts */}
            {avatarPrompts.length > 0 && (
              <div className="mt-8 space-y-6">
                <h3 className="text-lg font-medium">Generated Avatar Prompts:</h3>
                
                {avatarPrompts.map((prompt, index) => (
                  <div key={prompt.id} className="space-y-4">
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-700">
                            Avatar Prompt {index + 1}
                          </h4>
                          {prompt.isEdited && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                              Edited
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => generateAvatars(prompt.id, 4)}
                            disabled={prompt.isGeneratingImages}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                          >
                            {prompt.isGeneratingImages ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                <span>Creating...</span>
                              </div>
                            ) : (
                              'Create 4 Avatars'
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {/* Runway Prompt (Editable) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Avatar Prompt (Editable):
                        </label>
                        <textarea
                          value={prompt.runwayPrompt}
                          onChange={(e) => handlePromptEdit(prompt.id, e.target.value)}
                          className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                          placeholder="Edit your avatar prompt here..."
                        />
                      </div>

                      {/* Chinese Translation (Display Only) */}
                      {prompt.chineseTranslation && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Chinese Translation:
                          </label>
                          <div className="w-full min-h-[60px] p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-800">
                            {prompt.chineseTranslation}
                          </div>
                        </div>
                      )}

                      {/* Show failed generation count if any */}
                      {prompt.failedCount && prompt.failedCount > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-yellow-800 text-sm">
                            ⚠️ {prompt.failedCount} avatar{prompt.failedCount > 1 ? 's' : ''} failed to generate
                          </p>
                        </div>
                      )}

                      {/* Display Generated Avatars */}
                      {prompt.generatedImages.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-700">
                              Generated Avatars ({prompt.generatedImages.length}):
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {selectedAvatars.filter(avatar => prompt.generatedImages.some(img => img.id === avatar.id)).length} selected
                              </span>
                              <button
                                onClick={selectAllGeneratedAvatars}
                                className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                              >
                                Select All Generated
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {prompt.generatedImages.map((avatar) => (
                              <div
                                key={avatar.id}
                                onClick={() => selectGeneratedAvatar(avatar)}
                                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                  selectedAvatars.some(selected => selected.id === avatar.id) ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="aspect-square">
                                  <Image
                                    src={avatar.url}
                                    alt={avatar.filename}
                                    width={200}
                                    height={200}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                {selectedAvatars.some(selected => selected.id === avatar.id) && (
                                  <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => generateAvatars(prompt.id, 6)}
                              disabled={prompt.isGeneratingImages}
                              className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                              {prompt.isGeneratingImages ? (
                                <div className="flex items-center space-x-2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  <span>Creating More...</span>
                                </div>
                              ) : (
                                'Create 6 More Avatars'
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            ✅ Click to select/deselect avatars for batch upload
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                  💡 You can edit any prompt above and generate avatars with Runway AI. Select multiple avatars to upload them together as different looks for your avatar group.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Avatar Preview */}
      {selectedAvatars.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Selected Avatars ({selectedAvatars.length})
            </h2>
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Clear All Selection
            </button>
          </div>
          
          {/* Selected Avatars Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            {selectedAvatars.map((avatar) => (
              <div
                key={avatar.id}
                className="relative rounded-lg overflow-hidden border-2 border-green-500 ring-2 ring-green-200"
              >
                <div className="aspect-square">
                  <Image
                    src={avatar.url}
                    alt={avatar.filename || 'Generated Avatar'}
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs text-gray-600 truncate">
                    {avatar.filename || 'Generated Avatar'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload Controls */}
          <div className="space-y-3">
            <button
              onClick={uploadAvatars}
              disabled={isUploading}
              className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isUploading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                avatarSession?.avatarGroup 
                  ? `Upload ${selectedAvatars.length} Avatar${selectedAvatars.length > 1 ? 's' : ''} (Add Look${selectedAvatars.length > 1 ? 's' : ''})` 
                  : `Upload ${selectedAvatars.length} Avatar${selectedAvatars.length > 1 ? 's' : ''}`
              )}
            </button>

            {/* Video Creation Status */}
            {uploadStatus && (
              <div className={`p-3 rounded-lg border ${
                uploadStatus.includes('🎉') 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <p className="text-sm font-medium">{uploadStatus}</p>
              </div>
            )}

            {/* Avatar Group Information */}
            {avatarSession?.avatarGroup && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Avatar Group Created</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Group ID:</strong> {avatarSession.avatarGroup.id}</p>
                  <p><strong>Name:</strong> {avatarSession.avatarGroup.name}</p>
                  <p><strong>Status:</strong> {avatarSession.avatarGroup.status}</p>
                  <p><strong>Created:</strong> {new Date(avatarSession.avatarGroup.createdAt).toLocaleString()}</p>
                  <p><strong>Assets:</strong> {avatarSession.uploadedAssets.length} uploaded</p>
                </div>
                <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-600">
                  <p>✅ Your avatar group is ready! Next uploads will add new looks to this group.</p>
                </div>
              </div>
            )}

            {!avatarSession?.avatarGroup && (
              <p className="text-xs text-gray-500">
                This will upload your {selectedAvatars.length} selected avatar{selectedAvatars.length > 1 ? 's' : ''} to HeyGen and create a photo avatar group for video generation.
              </p>
            )}

            {avatarSession?.avatarGroup && (
              <p className="text-xs text-gray-500">
                This will add {selectedAvatars.length} new look{selectedAvatars.length > 1 ? 's' : ''} to your existing avatar group for more variety in video generation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Video Generation Section */}
      {avatarSession?.uploadedAssets && avatarSession.uploadedAssets.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Generate Video</h2>
          
          {/* Video Text Input */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Text:
              </label>
              <textarea
                value={videoText}
                onChange={(e) => setVideoText(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter the text for your avatar to speak..."
              />
            </div>
            
            {/* Voice Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                📢 Voice will be randomly selected from {voices.length} available voices
                {voices.length > 0 && (
                  <span className="ml-2">
                    (e.g., {voices.slice(0, 3).map(v => v.name).join(', ')}...)
                  </span>
                )}
              </p>
            </div>

            {/* Avatar Info */}
            {avatarSession?.uploadedAssets && avatarSession.uploadedAssets.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  🎭 <strong>Test Avatar:</strong> "{avatarSession.uploadedAssets[0].filename}"
                  <span className="block mt-1 text-xs text-blue-600">
                    Uploaded: {new Date(avatarSession.uploadedAssets[0].uploadedAt).toLocaleString()}
                  </span>
                  {avatarSession.avatarGroup?.motionEnabled && (
                    <span className="block mt-1 text-xs text-green-600">
                      ✨ Motion enabled - Ready for dynamic videos!
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Motion Controls */}
            {avatarSession?.avatarGroup && (
              <div className="space-y-3">
                {!avatarSession.avatarGroup.motionEnabled ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">🎬 Add Motion to Avatars</h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      Add natural motion to your photo avatars for more dynamic and lifelike videos. 
                      This will create motion-enabled versions of all avatars in your group.
                    </p>
                    
                    <button
                      onClick={addMotionToAvatars}
                      disabled={isAddingMotion}
                      className="w-full px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isAddingMotion ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Adding Motion...</span>
                        </div>
                      ) : (
                        `🎬 Add Motion to ${avatarSession.uploadedAssets.length} Avatar${avatarSession.uploadedAssets.length > 1 ? 's' : ''}`
                      )}
                    </button>

                    {/* Motion Status */}
                    {motionStatus && (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        motionStatus.includes('✅') 
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <p className="text-sm font-medium">{motionStatus}</p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-yellow-600">
                      💡 <strong>Note:</strong> Adding motion creates new avatar versions optimized for video generation. 
                      This process may take a few moments per avatar.
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">✨ Motion Enabled</h4>
                    <div className="text-sm text-green-700 space-y-1">
                      <p><strong>Status:</strong> Your avatars have motion enabled</p>
                      <p><strong>Motion Avatars:</strong> {avatarSession.motionAvatars?.length || 0} available</p>
                      <p><strong>Ready for:</strong> Dynamic video generation with natural movements</p>
                    </div>
                    <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-600">
                      🎬 Your avatars are now ready for enhanced video generation with natural motion!
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Generate Video Button */}
            <button
              onClick={generateVideo}
              disabled={isGeneratingVideo || !avatarSession?.uploadedAssets.length || !avatarSession?.avatarGroup}
              className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGeneratingVideo ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating Video...</span>
                </div>
              ) : !avatarSession?.avatarGroup ? (
                'Create Avatar Group First (Upload Avatars Above)'
              ) : (
                `Generate ${avatarSession.avatarGroup.motionEnabled ? 'Dynamic' : 'Static'} Video (Group: ${avatarSession.avatarGroup.name})`
              )}
            </button>

            {/* Video Generation Status */}
            {videoGenerationStatus && (
              <div className={`p-3 rounded-lg border ${
                videoGenerationStatus.includes('✅') 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : videoGenerationStatus.includes('❌')
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <p className="text-sm font-medium">{videoGenerationStatus}</p>
              </div>
            )}
          </div>

          {/* Generated Videos Display */}
          {generatedVideos.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Generated Videos ({generatedVideos.length})</h3>
              
              <div className="space-y-4">
                {generatedVideos.map((video) => (
                  <div key={video.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-800">Video #{video.videoId.slice(-8)}</h4>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(video.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        video.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : video.status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : video.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {video.status}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <p><strong>Text:</strong> {video.text}</p>
                      <p><strong>Asset ID:</strong> {video.assetId}</p>
                      <p><strong>Voice ID:</strong> {video.voiceId}</p>
                      {video.duration && (
                        <p><strong>Duration:</strong> {video.duration}s</p>
                      )}
                    </div>

                    {video.videoUrl && (
                      <div className="mt-4">
                        {/* Thumbnail if available */}
                        {video.thumbnailUrl && (
                          <div className="mb-3">
                            <img 
                              src={video.thumbnailUrl} 
                              alt="Video thumbnail" 
                              className="w-32 h-24 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        )}

                        {/* Video Player */}
                        <video 
                          controls 
                          className="w-full max-w-md rounded-lg"
                          src={video.videoUrl}
                          poster={video.thumbnailUrl}
                        >
                          Your browser does not support the video tag.
                        </video>

                        {/* Action Buttons */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {/* View/Open Video */}
                          <a
                            href={video.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Video
                          </a>

                          {/* Download Video */}
                          {video.downloadUrl && (
                            <a
                              href={video.downloadUrl}
                              download={`avatar-video-${video.videoId.slice(-8)}.mp4`}
                              className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Video
                            </a>
                          )}

                          {/* Copy Video URL */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(video.videoUrl || '');
                              // Show temporary feedback
                              const button = event?.target as HTMLButtonElement;
                              const originalText = button.textContent;
                              button.textContent = 'Copied!';
                              setTimeout(() => {
                                button.textContent = originalText;
                              }, 2000);
                            }}
                            className="inline-flex items-center px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy URL
                          </button>
                        </div>

                        {/* Video Details */}
                        {video.videoData && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <details className="text-xs text-gray-600">
                              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                                Video Details
                              </summary>
                              <div className="mt-2 space-y-1">
                                <p><strong>Video ID:</strong> {video.videoId}</p>
                                <p><strong>Status:</strong> {video.videoData.status}</p>
                                {video.videoData.video_url && (
                                  <p><strong>Stream URL:</strong> <a href={video.videoData.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{video.videoData.video_url}</a></p>
                                )}
                                {video.videoData.video_url_https && (
                                  <p><strong>HTTPS URL:</strong> <a href={video.videoData.video_url_https} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{video.videoData.video_url_https}</a></p>
                                )}
                                {video.videoData.download_url && (
                                  <p><strong>Download URL:</strong> <a href={video.videoData.download_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{video.videoData.download_url}</a></p>
                                )}
                                {video.videoData.thumbnail_url && (
                                  <p><strong>Thumbnail:</strong> <a href={video.videoData.thumbnail_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{video.videoData.thumbnail_url}</a></p>
                                )}
                                {video.videoData.gif_url && (
                                  <p><strong>GIF URL:</strong> <a href={video.videoData.gif_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{video.videoData.gif_url}</a></p>
                                )}
                                {video.videoData.duration && (
                                  <p><strong>Duration:</strong> {video.videoData.duration} seconds</p>
                                )}
                                {video.videoData.video_size && (
                                  <p><strong>File Size:</strong> {(video.videoData.video_size / 1024 / 1024).toFixed(2)} MB</p>
                                )}
                              </div>
                            </details>
                          </div>
                        )}

                        {video.status === 'processing' && (
                          <div className="mt-3 flex items-center text-sm text-blue-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Video is being processed... This may take a few minutes.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              💡 <strong>Avatar Video Generation:</strong> This will generate a video using your uploaded photo avatars. 
              {avatarSession?.avatarGroup?.motionEnabled ? (
                <span className="text-green-600">
                  <strong> Motion-enabled avatars</strong> will create more dynamic and lifelike videos with natural movements.
                </span>
              ) : (
                <span>
                  Add motion to your avatars for more <strong>dynamic and lifelike</strong> video results.
                </span>
              )}
            </p>
            {!avatarSession?.avatarGroup && (
              <p className="text-sm text-orange-600 mt-2">
                ⚠️ <strong>Avatar Group Required:</strong> Please upload avatars above first to create an avatar group, then you can generate videos.
              </p>
            )}
            {avatarSession?.avatarGroup && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-green-600">
                  ✅ <strong>Ready:</strong> Avatar group "{avatarSession.avatarGroup.name}" 
                  {avatarSession.avatarGroup.motionEnabled ? ' with motion enabled' : ' (static)'} is ready for video generation.
                </p>
                {avatarSession.avatarGroup.motionEnabled && (
                  <p className="text-xs text-green-500">
                    🎬 Motion avatars: {avatarSession.motionAvatars?.length || 0} available for dynamic video generation
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 