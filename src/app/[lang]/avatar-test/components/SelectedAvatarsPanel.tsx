import Image from 'next/image';
import { ExistingImage, GeneratedAvatar } from './types';
import { AvatarSessionData } from '@/utils/avatarSessionManager';

interface SelectedAvatarsPanelProps {
  selectedAvatars: (ExistingImage | GeneratedAvatar)[];
  isUploading: boolean;
  uploadStatus: string;
  avatarSession: AvatarSessionData | null;
  onGenerateCompleteVideo: () => void;
  onRemoveAvatar: (avatarId: string) => void;
  isAddingMotion: boolean;
  motionStatus: string;
  isGeneratingVideo: boolean;
  videoGenerationStatus: string;
}

export default function SelectedAvatarsPanel({
  selectedAvatars,
  isUploading,
  uploadStatus,
  avatarSession,
  onGenerateCompleteVideo,
  onRemoveAvatar,
  isAddingMotion,
  motionStatus,
  isGeneratingVideo,
  videoGenerationStatus
}: SelectedAvatarsPanelProps) {
  if (selectedAvatars.length === 0) {
    return null;
  }

  const isProcessing = isUploading || isAddingMotion || isGeneratingVideo;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium text-gray-800 mb-4">
        Selected Avatars ({selectedAvatars.length})
      </h3>
      
      {/* Selected Avatars Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-6">
        {selectedAvatars.map((avatar) => (
          <div key={avatar.id} className="relative">
            <div className="aspect-square rounded-lg overflow-hidden border-2 border-green-500">
              <Image
                src={avatar.url}
                alt={avatar.filename}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Delete button in upper left corner */}
            <button
              onClick={() => onRemoveAvatar(avatar.id)}
              disabled={isProcessing}
              className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 rounded-full flex items-center justify-center transition-colors"
              title="Remove avatar"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* Selection checkmark in upper right corner */}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onGenerateCompleteVideo}
          disabled={isProcessing}
          className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isProcessing ? 'Processing...' : '🎬 Complete Video Workflow'}
        </button>
      </div>

      {/* Status Messages */}
      {uploadStatus && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">{uploadStatus}</p>
        </div>
      )}

      {motionStatus && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">{motionStatus}</p>
        </div>
      )}

      {videoGenerationStatus && (
        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">{videoGenerationStatus}</p>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-xs text-gray-600">
          💡 <strong>Complete Integrated Workflow:</strong> Voice Selection → Audio Generation → Avatar Upload → Add Motion → Generate Videos (all in one process)
        </p>
        <p className="text-xs text-green-600 mt-1">
          🎤 <strong>Smart Features:</strong> AI analyzes your avatars and descriptions to automatically select the perfect voice and generate custom audio
        </p>
        <p className="text-xs text-purple-600 mt-1">
          🎬 <strong>Multi-Video:</strong> Generates separate videos for each selected avatar using the same audio
        </p>
      </div>
    </div>
  );
} 