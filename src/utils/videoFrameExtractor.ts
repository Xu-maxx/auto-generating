/**
 * Client-side video frame extraction utility
 * Extracts frames from video URLs without requiring server-side ffmpeg
 */

export interface VideoFrameExtractionResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

/**
 * Check if a URL is from the same origin (same protocol, domain, and port)
 */
const isSameOrigin = (url: string): boolean => {
  try {
    // Handle relative URLs (they are always same-origin)
    if (url.startsWith('/')) {
      return true;
    }
    
    // Handle absolute URLs
    const urlObj = new URL(url, window.location.origin);
    return urlObj.origin === window.location.origin;
  } catch (error) {
    console.error('Error checking URL origin:', error);
    // If we can't parse the URL, assume it's same-origin for safety
    return true;
  }
};

/**
 * Extract first frame from video URL using browser APIs
 * @param videoUrl - URL of the video file
 * @param timeOffset - Time offset in seconds to extract frame (default: 0.1)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Promise with extraction result
 */
export const extractVideoFrame = async (
  videoUrl: string, 
  timeOffset: number = 0.1, 
  quality: number = 0.8
): Promise<VideoFrameExtractionResult> => {
  console.log(`🎬 Starting video frame extraction from: ${videoUrl}`);
  
  const sameOrigin = isSameOrigin(videoUrl);
  console.log(`🔍 Video URL origin check: ${sameOrigin ? 'same-origin' : 'cross-origin'}`);
  
  if (sameOrigin) {
    // For same-origin videos, don't use CORS
    console.log(`🔗 Using same-origin extraction (no CORS)`);
    const result = await tryExtractWithCors(videoUrl, timeOffset, quality, false);
    if (result.success) {
      console.log(`✅ Same-origin frame extracted successfully`);
      return result;
    } else {
      console.error(`❌ Same-origin extraction failed: ${result.error}`);
      return result;
    }
  } else {
    // For cross-origin videos, try CORS first, then fallback
    console.log(`🌐 Using cross-origin extraction (with CORS fallback)`);
    
    // First try with CORS enabled (anonymous)
    const corsResult = await tryExtractWithCors(videoUrl, timeOffset, quality, true);
    if (corsResult.success) {
      console.log(`✅ Frame extracted successfully with CORS`);
      return corsResult;
    }
    
    console.log(`⚠️ CORS extraction failed, trying without CORS...`);
    
    // Fallback to without CORS
    const noCorsResult = await tryExtractWithCors(videoUrl, timeOffset, quality, false);
    if (noCorsResult.success) {
      console.log(`✅ Frame extracted successfully without CORS`);
      return noCorsResult;
    }
    
    console.error(`❌ Both CORS and non-CORS extraction failed`);
    return {
      success: false,
      error: `Failed to extract frame: ${noCorsResult.error}`
    };
  }
};

/**
 * Try to extract video frame with or without CORS
 */
const tryExtractWithCors = async (
  videoUrl: string,
  timeOffset: number,
  quality: number,
  useCors: boolean
): Promise<VideoFrameExtractionResult> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('❌ Canvas context not available');
        resolve({
          success: false,
          error: 'Canvas context not available'
        });
        return;
      }

      // Set CORS attribute if needed
      if (useCors) {
        video.crossOrigin = 'anonymous';
      }
      
      video.preload = 'metadata';
      video.muted = true; // Helps with autoplay restrictions

      video.onloadedmetadata = () => {
        console.log(`📐 Video metadata loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Seek to specified time offset or 1% of video duration, whichever is smaller
          const seekTime = Math.min(timeOffset, video.duration * 0.01);
          console.log(`⏱️ Seeking to time: ${seekTime}s`);
          video.currentTime = seekTime;
        } catch (error) {
          console.error('❌ Failed to set video time:', error);
          resolve({
            success: false,
            error: `Failed to set video time: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      video.onseeked = () => {
        console.log(`✅ Video seeked successfully, attempting frame extraction...`);
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          console.log(`🖼️ Frame extracted successfully, data URL length: ${dataUrl.length}`);
          
          // Clean up
          video.remove();
          canvas.remove();
          
          resolve({
            success: true,
            dataUrl: dataUrl
          });
        } catch (error) {
          console.error(`❌ Failed to extract frame${useCors ? ' with CORS' : ''}:`, error);
          resolve({
            success: false,
            error: `Failed to extract frame${useCors ? ' (CORS)' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      video.onerror = (event) => {
        console.error(`❌ Video load error${useCors ? ' with CORS' : ''}:`, event);
        resolve({
          success: false,
          error: `Video load error${useCors ? ' - CORS may be blocked' : ' - possibly network issue'}`
        });
      };

      video.ontimeupdate = () => {
        // Sometimes onseeked doesn't fire, use timeupdate as fallback
        const seekTime = Math.min(timeOffset, video.duration * 0.01);
        if (Math.abs(video.currentTime - seekTime) < 0.1) {
          video.ontimeupdate = null; // Prevent multiple calls
          console.log(`⏰ Using timeupdate fallback for frame extraction...`);
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            console.log(`🖼️ Frame extracted via fallback, data URL length: ${dataUrl.length}`);
            
            // Clean up
            video.remove();
            canvas.remove();
            
            resolve({
              success: true,
              dataUrl: dataUrl
            });
          } catch (error) {
            console.error(`❌ Failed to extract frame via fallback${useCors ? ' with CORS' : ''}:`, error);
            resolve({
              success: false,
              error: `Failed to extract frame via fallback${useCors ? ' (CORS)' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      };

      // Set timeout for cases where video doesn't load
      setTimeout(() => {
        if (video.readyState === 0) {
          console.error(`❌ Video load timeout after 15 seconds${useCors ? ' with CORS' : ''}`);
          video.remove();
          canvas.remove();
          resolve({
            success: false,
            error: `Video load timeout${useCors ? ' - CORS may be blocked' : ' - URL may not be accessible'}`
          });
        }
      }, 15000); // 15 second timeout

      console.log(`🔗 Setting video source${useCors ? ' with CORS' : ''}: ${videoUrl}`);
      video.src = videoUrl;
      video.load();

    } catch (error) {
      console.error(`❌ Extraction setup failed${useCors ? ' with CORS' : ''}:`, error);
      resolve({
        success: false,
        error: `Extraction setup failed${useCors ? ' (CORS)' : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
};

/**
 * Extract frame from video file (File object) using browser APIs
 * @param videoFile - Video File object
 * @param timeOffset - Time offset in seconds to extract frame (default: 0.1)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Promise with extraction result
 */
export const extractVideoFrameFromFile = async (
  videoFile: File, 
  timeOffset: number = 0.1, 
  quality: number = 0.8
): Promise<VideoFrameExtractionResult> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({
          success: false,
          error: 'Canvas context not available'
        });
        return;
      }

      const url = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Seek to specified time offset
          video.currentTime = Math.min(timeOffset, video.duration * 0.01);
        } catch (error) {
          URL.revokeObjectURL(url);
          resolve({
            success: false,
            error: `Failed to set video time: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Clean up
          URL.revokeObjectURL(url);
          video.remove();
          canvas.remove();
          
          resolve({
            success: true,
            dataUrl: dataUrl
          });
        } catch (error) {
          URL.revokeObjectURL(url);
          resolve({
            success: false,
            error: `Failed to extract frame: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          success: false,
          error: 'Error loading video file'
        });
      };

      video.src = url;
      video.load();

    } catch (error) {
      resolve({
        success: false,
        error: `Extraction setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}; 