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
  selectedAvatars = []
}: VideoGenerationPanelProps) {
  const [hasLoadedVoices, setHasLoadedVoices] = useState(false);

  useEffect(() => {
    if (!hasLoadedVoices) {
      onLoadVoices();
      setHasLoadedVoices(true);
    }
  }, [hasLoadedVoices, onLoadVoices]);

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

      {/* Status Messages */}
      {videoGenerationStatus && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">{videoGenerationStatus}</p>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>Integrated Workflow:</strong> Use the "🎬 Complete Video Workflow" button below to generate audio, upload avatars, add motion, and create videos all in one process.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          🎤 <strong>Smart Voice Selection:</strong> The system will automatically analyze your {avatarDescription ? 'avatar description' : ''}{avatarDescription && selectedAvatars.length > 0 ? ' and ' : ''}{selectedAvatars.length > 0 ? `${selectedAvatars.length} selected avatar${selectedAvatars.length > 1 ? 's' : ''}` : 'avatars'} to select the perfect voice for your video.
        </p>
      </div>
    </div>
  );
}