'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

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

export default function AvatarTestClient({ dict }: AvatarTestClientProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'generate'>('existing');
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<ExistingImage | GeneratedAvatar | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [avatarDescription, setAvatarDescription] = useState('');
  const [userRequirement, setUserRequirement] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [avatarPrompts, setAvatarPrompts] = useState<AvatarPrompt[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Select an existing image as avatar
  const selectExistingImage = (image: ExistingImage) => {
    const updatedImages = existingImages.map(img => ({
      ...img,
      selected: img.id === image.id
    }));
    setExistingImages(updatedImages);
    setSelectedAvatar(image);
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

  // Select a generated avatar
  const selectGeneratedAvatar = (avatar: GeneratedAvatar) => {
    setSelectedAvatar(avatar);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Avatar Video Creator - Testing</h1>
        <p className="text-gray-600 text-center">Choose an existing image or generate a new avatar for video creation</p>
      </div>

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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Upload Images
              </button>
              <button
                onClick={loadExistingImages}
                className="ml-3 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Load Existing Images
              </button>
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
                          <h4 className="font-medium text-gray-700">
                            Generated Avatars ({prompt.generatedImages.length}):
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {prompt.generatedImages.map((avatar) => (
                              <div
                                key={avatar.id}
                                onClick={() => selectGeneratedAvatar(avatar)}
                                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                  selectedAvatar?.id === avatar.id ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'
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
                                {selectedAvatar?.id === avatar.id && (
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
                            ✅ Single click to select, double click to preview
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                  💡 You can edit any prompt above and generate avatars with Runway AI. Click on any avatar to select it for video creation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Avatar Preview */}
      {selectedAvatar && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Selected Avatar</h2>
          <div className="flex items-start space-x-6">
            <div className="w-48 h-48 relative rounded-lg overflow-hidden">
              <Image
                src={selectedAvatar.url}
                alt="Selected Avatar"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-2">
                {'filename' in selectedAvatar ? selectedAvatar.filename : `Generated Avatar`}
              </h3>
              {'prompt' in selectedAvatar && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Generated from prompt:</p>
                  <p className="text-sm bg-gray-50 p-3 rounded border">{selectedAvatar.prompt}</p>
                </div>
              )}
              <div className="space-y-3">
                <button className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
                  Create Avatar Video
                </button>
                <p className="text-xs text-gray-500">
                  This will use the selected avatar to create a video animation. Video creation functionality will be implemented next.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 