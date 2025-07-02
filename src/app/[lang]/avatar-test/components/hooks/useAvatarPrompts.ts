import { useState } from 'react';
import { AvatarPrompt, ConversationMessage, GeneratedAvatar } from '../types';

export const useAvatarPrompts = () => {
  const [avatarDescription, setAvatarDescription] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [avatarPrompts, setAvatarPrompts] = useState<AvatarPrompt[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generatePrompt = async () => {
    setIsOptimizing(true);
    setError(null);

    try {
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

        setAvatarPrompts(prev => [...prev, newPrompt]);

        // Update conversation history
        setConversation(prev => [
          ...prev,
          { role: 'user', content: avatarDescription },
          { role: 'assistant', content: data.optimizedPrompt }
        ]);
      } else {
        setError(data.error || 'Failed to optimize prompt');
      }
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      setError('Network error occurred');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handlePromptEdit = (id: number, newRunwayPrompt: string) => {
    setAvatarPrompts(prev => prev.map(prompt => 
      prompt.id === id 
        ? { ...prompt, runwayPrompt: newRunwayPrompt, isEdited: true }
        : prompt
    ));
  };

  const generateAvatars = async (promptId: number, imageCount: number) => {
    const prompt = avatarPrompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Set generating state for this specific prompt
    setAvatarPrompts(prev => prev.map(p => 
      p.id === promptId 
        ? { ...p, isGeneratingImages: true }
        : p
    ));

    try {
      const response = await fetch('/api/runway-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptText: prompt.runwayPrompt,
          imageCount: imageCount
        }),
      });

      const data = await response.json();

      console.log('🖼️ Runway API Response:', {
        success: data.success,
        imagesCount: data.images?.length || 0,
        totalGenerated: data.totalGenerated,
        requested: data.requested,
        error: data.error
      });

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
          
          setAvatarPrompts(prev => prev.map(p => 
            p.id === promptId 
              ? { 
                  ...p, 
                  isGeneratingImages: false, 
                  generatedImages: [...p.generatedImages, ...newGeneratedImages]
                }
              : p
          ));

          // Show warning if not all images were generated
          if (data.images.length < imageCount) {
            setError(`Partially successful: ${data.images.length}/${imageCount} images generated`);
          }
        } else {
          // API succeeded but no images returned (likely timeout)
          console.log('⚠️ API succeeded but no images returned - likely timeout or polling issue');
          setAvatarPrompts(prev => prev.map(p => 
            p.id === promptId 
              ? { 
                  ...p, 
                  isGeneratingImages: false,
                  failedCount: p.failedCount + 1
                }
              : p
          ));
          setError('Generation timed out - no images were completed within the time limit');
        }
      } else {
        // API returned success: false
        console.log('❌ API returned success: false:', data.error);
        setAvatarPrompts(prev => prev.map(p => 
          p.id === promptId 
            ? { 
                ...p, 
                isGeneratingImages: false,
                failedCount: p.failedCount + 1
              }
            : p
        ));
        setError(data.error || 'Failed to generate avatars');
      }
    } catch (error) {
      console.error('Error generating avatars:', error);
      setAvatarPrompts(prev => prev.map(p => 
        p.id === promptId 
          ? { 
              ...p, 
              isGeneratingImages: false,
              failedCount: p.failedCount + 1
            }
          : p
      ));
      setError('Network error occurred during generation');
    }
  };

  return {
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
  };
}; 