'use client';

import { useState } from 'react';
import { ReferenceImage } from '@/types/session';
import ReferenceImageUpload from './ReferenceImageUpload';

interface PromptGeneratorProps {
  imageDataUrl: string;
  selectedImages: Set<string>;
  setSelectedImages: (images: Set<string>) => void;
  addedImages: GeneratedImage[];
  onAddImages: (allImages: GeneratedImage[]) => void;
  onClearAll: () => void;
  onImageDoubleClick: (image: GeneratedImage) => void;
  onPromptGenerated?: (prompt: string) => void;
  // Session-based state
  prompts: PromptWithSpec[];
  conversation: ConversationMessage[];
  userRequirement: string;
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (images: ReferenceImage[]) => void;
  // Combined update function to avoid race conditions
  updatePromptSession: (updates: {
    prompts?: PromptWithSpec[];
    conversation?: ConversationMessage[];
    userRequirement?: string;
  }) => void;
  projectStyle?: string; // Project style from project data
  dict: any; // Dictionary for translations
  // Image generation settings
  imageAspectRatio: string;
  imageResolution: {width: number, height: number};
}

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: any;
  editedContent?: string; // Store user edits
}

interface GeneratedImage {
  taskId: string;
  filename: string;
  url: string;
  prompt: string;
  status?: 'success' | 'failed';
  error?: string;
}

interface PromptWithSpec {
  id: number;
  content: string; // Original full response from OpenAI
  runwayPrompt: string; // Extracted runway prompt for editing
  chineseTranslation: string; // Extracted Chinese translation for display
  isEdited: boolean;
  specification?: string; // Store the user requirement that generated this prompt
  generatedImages?: GeneratedImage[]; // Store generated images for this prompt
  isGeneratingImages?: boolean; // Track if images are being generated
  failedCount?: number; // Track failed generations
}

// Utility function to parse the structured response
const parsePromptResponse = (content: string): { runwayPrompt: string; chineseTranslation: string } => {
  const runwayPromptMatch = content.match(/\*\*RUNWAY PROMPT:\*\*\s*([\s\S]*?)(?=\*\*CHINESE TRANSLATION:\*\*|$)/i);
  const chineseTranslationMatch = content.match(/\*\*CHINESE TRANSLATION:\*\*\s*([\s\S]*?)$/i);
  
  const runwayPrompt = runwayPromptMatch?.[1]?.trim() || content;
  const chineseTranslation = chineseTranslationMatch?.[1]?.trim() || '';
  
  return { runwayPrompt, chineseTranslation };
};

export default function PromptGenerator({ 
  imageDataUrl, 
  selectedImages, 
  setSelectedImages, 
  addedImages, 
  onAddImages, 
  onClearAll, 
  onImageDoubleClick,
  onPromptGenerated,
  prompts,
  conversation,
  userRequirement,
  referenceImages,
  onReferenceImagesChange,
  updatePromptSession,
  projectStyle,
  dict,
  imageAspectRatio,
  imageResolution
}: PromptGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [useProjectStyle, setUseProjectStyle] = useState(true);

  const generatePrompt = async () => {
    setIsGenerating(true);
    setError('');

    try {
      // Build conversation history for the API call
      let messages: ConversationMessage[] = [];
      
      if (conversation.length === 0) {
        // First time - include system prompt and image
        let systemContent = 'you will receive an image, base on that image you need to generate a prompt for image AI generator runway to generate an image just like the image I give you (as similar as possible). You need to output the response in the following structure:\n\n**RUNWAY PROMPT:**\n[The runway prompt in English]\n\n**CHINESE TRANSLATION:**\n[The Chinese translation of the runway prompt]\n\nMake sure to follow this exact format with the headers and structure.';
        
        // Add project style context if enabled and available
        if (useProjectStyle && projectStyle) {
          systemContent += ` Additionally, fit the style: ${projectStyle}`;
        }
        
        // Add reference images context as TEXT ONLY (don't send images to OpenAI)
        if (referenceImages.length > 0) {
          systemContent += ` Additionally, you should consider the following ${referenceImages.length} reference image${referenceImages.length > 1 ? 's' : ''} for style and composition guidance: `;
          referenceImages.forEach((refImg, index) => {
            systemContent += `Reference ${index + 1}: ${refImg.filename || 'Style reference image'}. `;
          });
        }
        
        // ONLY send the main uploaded image to OpenAI, no reference images
        const userContent: any[] = [
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ];

        messages = [
          {
            role: 'system',
            content: systemContent
          },
          {
            role: 'user',
            content: userContent,
          }
        ];
      } else {
        // Subsequent conversations - ONLY text, no images at all
        let systemContent = 'Based on the previous conversation about generating runway prompts, please create another variation that follows this structure:\n\n**RUNWAY PROMPT:**\n[The runway prompt in English]\n\n**CHINESE TRANSLATION:**\n[The Chinese translation of the runway prompt]\n\nMake sure to follow this exact format with the headers and structure.';
        
        // Add project style context if enabled and available
        if (useProjectStyle && projectStyle) {
          systemContent += ` Additionally, fit the style: ${projectStyle}`;
        }

        // Add reference images context as TEXT ONLY
        if (referenceImages.length > 0) {
          systemContent += ` Additionally, consider the following ${referenceImages.length} reference image${referenceImages.length > 1 ? 's' : ''} for style guidance: `;
          referenceImages.forEach((refImg, index) => {
            systemContent += `Reference ${index + 1}: ${refImg.filename || 'Style reference image'}. `;
          });
        }

        // For subsequent requests, only include text-based conversation history
        const textOnlyConversation = conversation.slice(2).map(msg => ({
          ...msg,
          content: typeof msg.content === 'string' 
            ? (msg.role === 'assistant' && msg.editedContent ? msg.editedContent : msg.content)
            : 'Previous image-based conversation'
        }));

        messages = [
          {
            role: 'system',
            content: systemContent
          },
          // Add simplified conversation history (text only)
          ...textOnlyConversation,
          {
            role: 'user',
            content: userRequirement.trim() 
              ? `Please provide another runway prompt variation based on the same original image. ${userRequirement.trim()}. Make sure to follow the exact output format with **RUNWAY PROMPT:** and **CHINESE TRANSLATION:** sections.`
              : 'Please provide another runway prompt variation based on the same original image, make it different from the previous ones but still accurate to the original image. Make sure to follow the exact output format with **RUNWAY PROMPT:** and **CHINESE TRANSLATION:** sections.'
          }
        ];
      }

      console.log('🤖 Generating prompt with', messages.length, 'messages');
      console.log('🖼️ Images in request:', messages.reduce((count, msg) => {
        if (Array.isArray(msg.content)) {
          return count + msg.content.filter(item => item.type === 'image_url').length;
        }
        return count;
      }, 0));
      
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
        }),
      });

      console.log('📡 API call completed, checking response...');
      console.log('🌐 Response status:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API response not ok:', errorText);
        throw new Error(`Failed to generate prompt: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🤖 Prompt generation response:', data);
      
      if (data.error) {
        console.error('❌ API returned error:', data.error);
        throw new Error(data.error);
      }

      // Handle both new format (with success) and legacy format (direct prompt)
      const promptContent = data.prompt || data.fullResponse || '';
      const runwayPrompt = data.runwayPrompt || '';
      const chineseTranslation = data.chineseTranslation || '';

      if (!promptContent) {
        throw new Error('Empty prompt response from API');
      }

      // If we didn't get parsed data, parse it ourselves
      let finalRunwayPrompt = runwayPrompt;
      let finalChineseTranslation = chineseTranslation;
      
      if (!finalRunwayPrompt && !finalChineseTranslation) {
        const parsed = parsePromptResponse(promptContent);
        finalRunwayPrompt = parsed.runwayPrompt;
        finalChineseTranslation = parsed.chineseTranslation;
      }

      console.log('✅ Prompt parsed successfully:', {
        runwayPromptLength: finalRunwayPrompt.length,
        chineseTranslationLength: finalChineseTranslation.length
      });

      const newPrompt: PromptWithSpec = {
        id: Date.now(),
        content: promptContent,
        runwayPrompt: finalRunwayPrompt,
        chineseTranslation: finalChineseTranslation,
        isEdited: false,
        specification: userRequirement.trim() || undefined,
        generatedImages: [],
        isGeneratingImages: false,
        failedCount: 0
      };

      // Add new conversation message
      const newConversation = [
        ...conversation,
        {
          role: 'user' as const,
          content: userRequirement.trim() || 'Generate runway prompt'
        },
        {
          role: 'assistant' as const,
          content: promptContent
        }
      ];

      // Update all prompt-related state in one call
      updatePromptSession({
        prompts: [...prompts, newPrompt],
        conversation: newConversation,
        userRequirement: '' // Clear user requirement after successful generation
      });

      if (onPromptGenerated) {
        onPromptGenerated(promptContent);
      }

      console.log('✅ Prompt generated successfully!');
    } catch (error) {
      console.error('❌ Error generating prompt:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // More specific error messages
      if (errorMessage.includes('timeout')) {
        setError('Request timed out. Please try again.');
      } else if (errorMessage.includes('rate limit')) {
        setError('Rate limit exceeded. Please try again later.');
      } else if (errorMessage.includes('API key')) {
        setError('API key configuration issue. Please check settings.');
      } else if (errorMessage.includes('Network')) {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePromptEdit = (id: number, newRunwayPrompt: string) => {
    const updatedPrompts = prompts.map(prompt => 
      prompt.id === id 
        ? { ...prompt, runwayPrompt: newRunwayPrompt, isEdited: true }
        : prompt
    );
    updatePromptSession({ prompts: updatedPrompts });
  };

  const generateImages = async (promptId: number, imageCount: number) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt || prompt.isGeneratingImages) return;

    // Update prompt state to show generating
    const updatedPrompts = prompts.map(p => 
      p.id === promptId 
        ? { ...p, isGeneratingImages: true }
        : p
    );
    updatePromptSession({ prompts: updatedPrompts });

    try {
      const response = await fetch('/api/runway-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: prompt.runwayPrompt,
          imageCount: imageCount,
          referenceImages: referenceImages,
          aspectRatio: imageAspectRatio,
          resolution: imageResolution
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate images');
      }

      if (data.success && data.images) {
        // Update prompt with new images
        const finalUpdatedPrompts = prompts.map(p => 
          p.id === promptId 
            ? { 
                ...p, 
                generatedImages: [...(p.generatedImages || []), ...data.images],
                isGeneratingImages: false,
                failedCount: (p.failedCount || 0) + (data.requested - data.totalGenerated || 0)
              }
            : p
        );
        updatePromptSession({ prompts: finalUpdatedPrompts });
      } else {
        throw new Error(data.error || 'No images generated');
      }
    } catch (error) {
      console.error('Error generating images:', error);
      // Update prompt state to stop generating and increment failed count
      const errorUpdatedPrompts = prompts.map(p => 
        p.id === promptId 
          ? { 
              ...p, 
              isGeneratingImages: false,
              failedCount: (p.failedCount || 0) + imageCount
            }
          : p
      );
      updatePromptSession({ prompts: errorUpdatedPrompts });
    }
  };

  const handleImageClick = (image: GeneratedImage) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(image.taskId)) {
      newSelected.delete(image.taskId);
    } else {
      newSelected.add(image.taskId);
    }
    setSelectedImages(newSelected);
  };

  const handleImageDoubleClick = (image: GeneratedImage) => {
    onImageDoubleClick(image);
  };

  const addSelectedImages = () => {
    const allGeneratedImages = prompts.flatMap(p => p.generatedImages || []);
    onAddImages(allGeneratedImages);
    setSelectedImages(new Set()); // Clear selections
  };

  const clearConversation = () => {
    updatePromptSession({
      prompts: [],
      conversation: [],
      userRequirement: ''
    });
    onClearAll();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Reference Images Upload */}
      <ReferenceImageUpload 
        referenceImages={referenceImages}
        onReferenceImagesChange={onReferenceImagesChange}
        maxImages={4}
        dict={dict}
      />

      {/* Project Style Option */}
      {projectStyle && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="useProjectStyle"
              checked={useProjectStyle}
              onChange={(e) => setUseProjectStyle(e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <label htmlFor="useProjectStyle" className="text-sm font-medium text-blue-900 cursor-pointer">
                {dict.promptGenerator.useProjectStyle}
              </label>
              <p className="text-xs text-blue-700 mt-1">
                {dict.promptGenerator.includeProjectStyleTip}: "{projectStyle}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Initial Generate Button - Show when no prompts exist */}
      {prompts.length === 0 && (
        <div className="text-center">
          <button
            onClick={generatePrompt}
            disabled={isGenerating || !imageDataUrl}
            className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isGenerating ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{dict.promptGenerator.generating}</span>
              </div>
            ) : (
              dict.promptGenerator.generatePrompts
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <h3 className="font-semibold">{dict.promptGenerator.error}</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Display Prompts with their Specifications */}
      {prompts.length > 0 && (
        <div className="space-y-8">
          <h3 className="text-lg font-semibold text-gray-800 text-center">
            {dict.promptGenerator.generatedPrompts}
          </h3>
          
          {prompts.map((prompt, index) => (
            <div key={prompt.id} className="space-y-4">
              {/* Show specification if it exists */}
              {prompt.specification && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                      {index}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-blue-800 mb-1">{dict.promptGenerator.yourRequirement}</h5>
                      <p className="text-blue-700 text-sm italic">"{prompt.specification}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show the generated prompt */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-700">
                      {dict.promptGenerator.promptNumber.replace('{number}', (index + 1).toString())}
                    </h4>
                    {prompt.isEdited && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        {dict.promptGenerator.edited}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateImages(prompt.id, 4)}
                      disabled={prompt.isGeneratingImages}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {prompt.isGeneratingImages ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          <span>{dict.promptGenerator.creating}</span>
                        </div>
                      ) : (
                        dict.promptGenerator.create4Images
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Runway Prompt (Editable) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {dict.promptGenerator.runwayPromptEditable}
                  </label>
                  <textarea
                    value={prompt.runwayPrompt}
                    onChange={(e) => handlePromptEdit(prompt.id, e.target.value)}
                    className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    placeholder={dict.promptGenerator.editPromptPlaceholder}
                  />
                </div>

                {/* Chinese Translation (Display Only) */}
                {prompt.chineseTranslation && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {dict.promptGenerator.chineseTranslation}
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
                      ⚠️ {dict.promptGenerator.imagesFailedToGenerate
                        .replace('{count}', prompt.failedCount.toString())
                        .replace('{plural}', prompt.failedCount > 1 ? 's' : '')}
                    </p>
                  </div>
                )}

                {/* Display Generated Images */}
                {prompt.generatedImages && prompt.generatedImages.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-700">
                      {dict.promptGenerator.generatedImagesCount.replace('{count}', prompt.generatedImages.length.toString())}
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {prompt.generatedImages.map((image, imgIndex) => {
                        const isSelected = selectedImages.has(image.taskId);
                        const isAdded = addedImages.find(added => added.taskId === image.taskId);
                        
                        return (
                          <div key={image.taskId} className="relative group">
                            <div className={`relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                              isSelected || isAdded ? 'border-green-500' : 'border-transparent'
                            }`}>
                              <img
                                src={image.url}
                                alt={`Generated image ${imgIndex + 1}`}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                onClick={() => handleImageClick(image)}
                                onDoubleClick={() => handleImageDoubleClick(image)}
                                onError={(e) => {
                                  console.error('Image failed to load:', image.url);
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                  e.currentTarget.style.display = 'flex';
                                  e.currentTarget.style.alignItems = 'center';
                                  e.currentTarget.style.justifyContent = 'center';
                                  e.currentTarget.style.color = '#dc2626';
                                  e.currentTarget.style.fontSize = '12px';
                                  e.currentTarget.innerHTML = dict.promptGenerator.failedToLoad;
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully:', image.url);
                                }}
                              />
                              {/* Tick mark for added images */}
                              {isAdded && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">{image.filename}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Create More Images Button - Always available when images exist */}
                    <div className="flex justify-center pt-2">
                      <button
                        onClick={() => generateImages(prompt.id, 6)}
                        disabled={prompt.isGeneratingImages}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {prompt.isGeneratingImages ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            <span>{dict.promptGenerator.creatingMore}</span>
                          </div>
                        ) : (
                          dict.promptGenerator.create6MoreImages
                        )}
                      </button>
                    </div>

                    {/* ADD button for this prompt's images */}
                    {selectedImages.size > 0 && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={addSelectedImages}
                          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                        >
                          {dict.promptGenerator.addImages.replace('{count}', selectedImages.size.toString())}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <p>{dict.promptGenerator.clickInstructions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Requirement Input - Show after existing prompts */}
      {prompts.length > 0 && (
        <div className="space-y-4 border-t pt-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-800">
              {dict.promptGenerator.specifyChanges}
            </h4>
            <div className="space-y-2">
              <textarea
                value={userRequirement}
                onChange={(e) => updatePromptSession({
                  userRequirement: e.target.value
                })}
                placeholder={dict.promptGenerator.specifyChangesPlaceholder}
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500">
                {dict.promptGenerator.specifyChangesTip}
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={generatePrompt}
              disabled={isGenerating || !imageDataUrl}
              className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isGenerating ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{dict.promptGenerator.generating}</span>
                </div>
              ) : (
                userRequirement.trim() ? dict.promptGenerator.generateWithChanges : dict.promptGenerator.generateAnotherVariation
              )}
            </button>

            <button
              onClick={clearConversation}
              className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              {dict.promptGenerator.clearAll}
            </button>
          </div>
        </div>
      )}

      {prompts.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          <p>
            {dict.promptGenerator.editTip}
          </p>
        </div>
      )}
    </div>
  );
} 