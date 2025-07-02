import { GeneratedVideo } from './types';

interface GeneratedVideosDisplayProps {
  generatedVideos: GeneratedVideo[];
  forceRender: number;
}

export default function GeneratedVideosDisplay({
  generatedVideos,
  forceRender
}: GeneratedVideosDisplayProps) {
  return (
    <div className="space-y-4" key={`videos-${forceRender}`}>
      <h3 className="text-lg font-medium">
        🔍 DEBUG: Generated Videos (length: {generatedVideos.length}) - Render: {forceRender}
      </h3>
      
      {/* EMERGENCY DEBUG: Always show this */}
      <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg">
        <h4 className="font-bold text-red-800">🚨 EMERGENCY DEBUG - Always Visible:</h4>
        <p className="text-red-800">
          <strong>generatedVideos.length:</strong> {generatedVideos.length}
        </p>
        <p className="text-red-800">
          <strong>generatedVideos.length &gt; 0:</strong> {generatedVideos.length > 0 ? 'TRUE' : 'FALSE'}
        </p>
        <p className="text-red-800">
          <strong>Force render count:</strong> {forceRender}
        </p>
        {generatedVideos.length > 0 && (
          <>
            <p className="text-red-800">
              <strong>First video has URL:</strong> {generatedVideos[0]?.videoUrl ? 'YES' : 'NO'}
            </p>
            <pre className="text-xs text-red-700 mt-2 whitespace-pre-wrap">
              {JSON.stringify(generatedVideos[0], null, 2)}
            </pre>
          </>
        )}
      </div>
      
      {generatedVideos.length > 0 && (
        <div className="space-y-4">
          {generatedVideos.map((video) => {
            console.log(`🎬 Rendering video ${video.videoId}:`, {
              id: video.id,
              videoId: video.videoId,
              status: video.status,
              hasVideoUrl: !!video.videoUrl,
              videoUrl: video.videoUrl,
              duration: video.duration
            });
            
            return (
            <div key={`${video.id}-${forceRender}`} className="border border-gray-200 rounded-lg p-4">
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

              {/* DEBUG: Show video URL status */}
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p><strong>DEBUG:</strong> videoUrl exists: {!!video.videoUrl ? 'YES' : 'NO'}</p>
                <p><strong>Render count:</strong> {forceRender}</p>
                <p><strong>Conditional check:</strong> {video.videoUrl ? 'SHOULD SHOW PLAYER' : 'SHOULD SHOW PROCESSING'}</p>
                {video.videoUrl && <p><strong>URL:</strong> {video.videoUrl.substring(0, 100)}...</p>}
              </div>

              {/* Show video player when we have video URL */}
              {video.videoUrl && (
                <div className="mt-4" key={`player-${video.id}-${forceRender}`}>
                  <div className="mb-4 p-3 bg-green-100 border-2 border-green-500 rounded-lg">
                    <p className="text-green-800 font-bold">🎬 VIDEO READY!</p>
                    <p className="text-sm text-green-700">
                      Status: {video.status} | Duration: {video.duration}s
                    </p>
                  </div>
                  
                  {/* Video Player */}
                  <video 
                    controls 
                    className="w-full max-w-md rounded-lg"
                    src={video.videoUrl}
                    poster={video.thumbnailUrl}
                    key={`video-element-${video.id}-${forceRender}`}
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
                    >
                      Open Video
                    </a>

                    <a
                      href={video.videoUrl}
                      download={`avatar-video-${video.videoId.slice(-8)}.mp4`}
                      className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
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
    </div>
  );
} 