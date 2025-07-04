import { useState } from 'react';
import { GeneratedVideo } from './types';
import { VideoGenerationTask } from '@/types/session';
import AvatarSubmissionButton from '@/components/AvatarSubmissionButton';

interface GeneratedVideosDisplayProps {
  generatedVideos: GeneratedVideo[];
  forceRender: number;
  productId?: string;
  productName?: string;
}

export default function GeneratedVideosDisplay({
  generatedVideos,
  forceRender,
  productId,
  productName
}: GeneratedVideosDisplayProps) {
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Convert GeneratedVideo to VideoGenerationTask format for submission
  const convertToVideoGenerationTask = (video: GeneratedVideo): VideoGenerationTask => {
    return {
      taskId: video.videoId,
      imageName: `avatar-${video.videoId.slice(-8)}`,
      imageIndex: 0,
      status: 'downloaded', // Avatar videos are already completed
      videoUrl: video.videoUrl,
      relativePath: video.videoUrl, // Use video URL as path for avatar videos
      localPath: video.videoUrl,
      previewUrl: video.originalAvatarImageUrl || video.thumbnailUrl || video.videoUrl // Use original avatar image for keyframe extraction
    };
  };

  const handleVideoClick = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const completedVideos = generatedVideos.filter(video => video.status === 'completed' && video.videoUrl);
  const selectedVideoTasks = completedVideos
    .filter(video => selectedVideos.has(video.videoId))
    .map(convertToVideoGenerationTask);

  return (
    <div className="space-y-4" key={`videos-${forceRender}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Generated Avatar Videos ({generatedVideos.length})
        </h3>
        
        {/* Avatar Submission Section */}
        {completedVideos.length > 0 && productId && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedVideos.size} of {completedVideos.length} selected
            </span>
            {selectedVideos.size > 0 && (
              <button
                onClick={() => setSelectedVideos(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Selection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avatar Submission Button */}
      {completedVideos.length > 0 && selectedVideos.size > 0 && productId && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-200">
          <AvatarSubmissionButton
            videoTasks={selectedVideoTasks}
            productId={parseInt(productId)}
            productName={productName || `Product ${productId}`}
            onSubmissionComplete={(results) => {
              console.log('Avatar submission completed:', results);
              // Clear selected videos after successful submission
              setSelectedVideos(new Set());
              
              // Optional: Show success message
              const successCount = results.filter(r => r.success).length;
              if (successCount > 0) {
                alert(`Successfully submitted ${successCount} avatar videos!`);
              }
            }}
            onSubmissionError={(error) => {
              console.error('Avatar submission error:', error);
              alert(`Avatar submission failed: ${error}`);
            }}
          />
        </div>
      )}
      
      {generatedVideos.length > 0 && (
        <div className="space-y-4">
          {generatedVideos.map((video) => {
            const isCompleted = video.status === 'completed' && video.videoUrl;
            const isSelected = selectedVideos.has(video.videoId);
            
            return (
            <div 
              key={`${video.id}-${forceRender}`} 
              className={`border rounded-lg p-4 transition-all ${
                isCompleted && productId
                  ? `cursor-pointer hover:shadow-md ${
                      isSelected 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-green-300'
                    }`
                  : 'border-gray-200'
              }`}
              onClick={() => isCompleted && productId && handleVideoClick(video.videoId)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="font-medium text-gray-800">Avatar Video #{video.videoId.slice(-8)}</h4>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(video.createdAt).toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Selection indicator for completed videos */}
                  {isCompleted && productId && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
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

              {/* Show video player when we have video URL */}
              {video.videoUrl && (
                <div className="mt-4" key={`player-${video.id}-${forceRender}`}>
                  <div className="mb-4 p-3 bg-green-100 border-2 border-green-500 rounded-lg">
                    <p className="text-green-800 font-bold">🎬 VIDEO READY!</p>
                    <p className="text-sm text-green-700">
                      Status: {video.status} | Duration: {video.duration}s
                    </p>
                    {productId && (
                      <p className="text-sm text-green-600 mt-1">
                        💡 Click this video card to select it for avatar submission
                      </p>
                    )}
                  </div>
                  
                  {/* Video Player */}
                  <video 
                    controls 
                    className="w-full max-w-md rounded-lg"
                    src={video.videoUrl}
                    poster={video.thumbnailUrl}
                    key={`video-element-${video.id}-${forceRender}`}
                    onClick={(e) => e.stopPropagation()} // Prevent card selection when clicking video controls
                  >
                    Your browser does not support the video tag.
                  </video>

                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={video.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      onClick={(e) => e.stopPropagation()} // Prevent card selection
                    >
                      Open Video
                    </a>

                    <a
                      href={video.videoUrl}
                      download={`avatar-video-${video.videoId.slice(-8)}.mp4`}
                      className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      onClick={(e) => e.stopPropagation()} // Prevent card selection
                    >
                      Download Video
                    </a>
                  </div>
                </div>
              )}

              {/* Show processing status when video is not ready */}
              {!video.videoUrl && (
                <div className="mt-4">
                  {video.status === 'processing' && (
                    <div className="flex items-center text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Video is being processed...
                    </div>
                  )}
                  {video.status === 'failed' && (
                    <div className="text-sm text-red-600">
                      ❌ Video generation failed
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Instructions for avatar submission */}
      {completedVideos.length > 0 && productId && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📋 Avatar Video Submission Instructions</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Click on completed avatar videos to select them for submission</li>
            <li>• Selected videos will be submitted as avatar materials (Type: 3001 - 口播)</li>
            <li>• Tags will be automatically set to "avatar"</li>
            <li>• Videos will be associated with Product ID: {productId}</li>
          </ul>
        </div>
      )}
    </div>
  );
} 