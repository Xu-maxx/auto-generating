import { useState, useEffect } from 'react';
import { AvatarSessionData } from '@/utils/avatarSessionManager';

interface VideoGenerationPanelProps {
  avatarSession: AvatarSessionData | null;
  videoText: string;
  setVideoText: (text: string) => void;
  isGeneratingVideo: boolean;
  videoGenerationStatus: string;
  onLoadVoices: () => void;
  isAddingMotion: boolean;
  motionStatus: string;
  avatarDescription?: string;
  selectedAvatars?: any[];
  onAudioGenerated?: (audioUrl: string, audioInfo: { duration?: string; reqid?: string; voice?: string }) => void;
  onAudioCleared?: () => void;
}

export default function VideoGenerationPanel({
  avatarSession,
  videoText,
  setVideoText,
  isGeneratingVideo,
  videoGenerationStatus,
  onLoadVoices,
  isAddingMotion,
  motionStatus,
  avatarDescription,
  selectedAvatars = [],
  onAudioGenerated,
  onAudioCleared
}: VideoGenerationPanelProps) {
  const [hasLoadedVoices, setHasLoadedVoices] = useState(false);
  const [isSelectingVoice, setIsSelectingVoice] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voiceSelectionError, setVoiceSelectionError] = useState<string>('');
  const [fallbackInfo, setFallbackInfo] = useState<{used: boolean, reason?: string}>({used: false});
  const [voiceReasoning, setVoiceReasoning] = useState<string>('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>('');
  const [audioGenerationError, setAudioGenerationError] = useState<string>('');
  const [audioInfo, setAudioInfo] = useState<{duration?: string, reqid?: string}>({});

  useEffect(() => {
    if (!hasLoadedVoices) {
      onLoadVoices();
      setHasLoadedVoices(true);
    }
  }, [hasLoadedVoices, onLoadVoices]);

  const handleGenerateAudio = async () => {
    if (!videoText.trim()) {
      setAudioGenerationError('Please enter text to generate audio');
      return;
    }

    setIsSelectingVoice(true);
    setIsGeneratingAudio(true);
    setVoiceSelectionError('');
    setAudioGenerationError('');
    setSelectedVoice('');
    setVoiceReasoning('');
    setGeneratedAudioUrl('');
    setAudioInfo({});

    try {
      // Step 1: Select Voice
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
      const selectedVoiceName = voiceData.selectedVoice;
      setSelectedVoice(selectedVoiceName);
      setVoiceReasoning(voiceData.reasoning || '');
      
      console.log('✅ Step 1 Complete - OpenAI selected voice:', selectedVoiceName);
      console.log('📝 Reasoning:', voiceData.reasoning);
      
      if (voiceData.fallbackUsed || voiceData.fallback) {
        console.warn('⚠️ Fallback voice used.');
        console.log('📝 Fallback reason:', voiceData.error || 'Voice selection fallback');
        setFallbackInfo({used: true, reason: voiceData.error || 'Smart fallback selection'});
      } else {
        setFallbackInfo({used: false});
      }

      // Step 2: Generate Audio with Selected Voice
      setIsSelectingVoice(false);
      console.log('🎵 Step 2: Starting audio generation with selected voice...');
      console.log('🗣️ Voice:', selectedVoiceName);
      console.log('📝 Text:', videoText);

      const audioResponse = await fetch('/api/volcengine-generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: videoText,
          voiceName: selectedVoiceName,
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
      
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      setAudioInfo({
        duration: audioData.duration,
        reqid: audioData.reqid
      });

      console.log('✅ Step 2 Complete - Audio generated successfully!');
      console.log('🎵 Duration:', audioData.duration ? `${audioData.duration}ms` : 'Unknown');

      if (onAudioGenerated) {
        onAudioGenerated(audioUrl, {
          duration: audioData.duration,
          reqid: audioData.reqid,
          voice: selectedVoiceName
        });
      }

    } catch (error) {
      console.error('❌ Error in combined voice selection and audio generation:', error);
      if (error instanceof Error && error.message.includes('voice selection')) {
        setVoiceSelectionError(error.message);
      } else {
        setAudioGenerationError(error instanceof Error ? error.message : 'Failed to generate audio');
      }
    } finally {
      setIsSelectingVoice(false);
      setIsGeneratingAudio(false);
    }
  };

  // Cleanup audio URL when component unmounts
  useEffect(() => {
    return () => {
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);

  const clearAudio = () => {
    setSelectedVoice('');
    setVoiceReasoning('');
    setFallbackInfo({used: false});
    setVoiceSelectionError('');
    setIsGeneratingAudio(false);
    setGeneratedAudioUrl('');
    setAudioInfo({});
    setAudioGenerationError('');

    if (onAudioCleared) {
      onAudioCleared();
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Video Settings</h3>
      
      {/* Video Text Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video Text
        </label>
        <textarea
          value={videoText}
          onChange={(e) => setVideoText(e.target.value)}
          placeholder="Enter the text for your avatar to speak..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
        />
      </div>

      {/* Generate Audio Button */}
      <div className="mb-4">
        <button
          onClick={handleGenerateAudio}
          disabled={(isSelectingVoice || isGeneratingAudio) || (!avatarDescription && selectedAvatars.length === 0) || !videoText.trim()}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSelectingVoice ? 'Step 1/2: Selecting Voice...' : 
           isGeneratingAudio ? 'Step 2/2: Generating Audio...' : 
           '🎵 Generate Audio (Auto-Select Voice)'}
        </button>
        
        {/* Voice Selection Results */}
        {selectedVoice && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>🎤 Selected Voice:</strong> {selectedVoice}
            </p>
            {voiceReasoning && (
              <p className="text-xs text-green-700 mt-1">
                <strong>💭 Reasoning:</strong> {voiceReasoning}
              </p>
            )}
            {fallbackInfo.used && (
              <p className="text-xs text-green-700 mt-1">
                ℹ️ {fallbackInfo.reason || 'Smart fallback selection used'}
              </p>
            )}
          </div>
        )}
        
        {voiceSelectionError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>❌ Voice Selection Error:</strong> {voiceSelectionError}
            </p>
          </div>
        )}
        
        {audioGenerationError && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>❌ Audio Generation Error:</strong> {audioGenerationError}
            </p>
          </div>
        )}
        
        {!avatarDescription && selectedAvatars.length === 0 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              💡 Please generate avatar prompts or select images first to enable intelligent voice selection
            </p>
          </div>
        )}

        {!videoText.trim() && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              💡 Please enter text above to enable audio generation
            </p>
          </div>
        )}

        {(avatarDescription || selectedAvatars.length > 0) && videoText.trim() && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              🤖 Ready! AI will analyze {avatarDescription ? 'your prompt' : ''}{avatarDescription && selectedAvatars.length > 0 ? ' and ' : ''}{selectedAvatars.length > 0 ? `${selectedAvatars.length} generated avatar image${selectedAvatars.length > 1 ? 's' : ''}` : ''} to select the perfect voice, then generate audio automatically
            </p>
          </div>
        )}
      </div>

      {/* Audio Generation Results */}
      {generatedAudioUrl && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 mb-2">🎵 Generated Audio</h4>
          <audio 
            controls 
            className="w-full mb-2"
            preload="metadata"
          >
            <source src={generatedAudioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <div className="text-xs text-green-700">
            <p><strong>Voice:</strong> {selectedVoice}</p>
            {audioInfo.duration && (
              <p><strong>Duration:</strong> {Math.round(parseInt(audioInfo.duration) / 1000 * 100) / 100}s</p>
            )}
            {audioInfo.reqid && (
              <p><strong>Request ID:</strong> {audioInfo.reqid}</p>
            )}
          </div>
        </div>
      )}

      {/* Status Messages */}
      {videoGenerationStatus && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">{videoGenerationStatus}</p>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>Workflow:</strong> 1) Enter your text → 2) Click "Generate Audio (Auto-Select Voice)" → 3) Use "🎬 Complete Video Workflow" below to create the final video with your custom audio
        </p>
        {generatedAudioUrl && (
          <p className="text-xs text-green-600 mt-1">
            ✅ <strong>Ready:</strong> Your generated audio will be automatically used in the Complete Video Workflow!
          </p>
        )}
      </div>

      {/* Clear Audio Button */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <button
          onClick={clearAudio}
          className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          🗑️ Clear Audio
        </button>
      </div>
    </div>
  );
}