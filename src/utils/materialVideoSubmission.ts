import MaterialSubmissionService, { MaterialSubmissionData } from './materialSubmission';
import { VideoGenerationTask } from '@/types/session';

export interface MaterialVideoSubmissionOptions {
  productId: number;
  materialType: 'avatar' | 'material';
  tags: string;
  onProgress?: (status: string, details?: any) => void;
  onError?: (error: string) => void;
}

export interface MaterialVideoSubmissionResult {
  success: boolean;
  materialId?: number;
  filePath?: string;
  error?: string;
}

export class MaterialVideoSubmissionHelper {
  private static instance: MaterialVideoSubmissionHelper;
  private submissionService: MaterialSubmissionService;

  private constructor() {
    this.submissionService = MaterialSubmissionService.getInstance();
  }

  public static getInstance(): MaterialVideoSubmissionHelper {
    if (!MaterialVideoSubmissionHelper.instance) {
      MaterialVideoSubmissionHelper.instance = new MaterialVideoSubmissionHelper();
    }
    return MaterialVideoSubmissionHelper.instance;
  }

  /**
   * Submit a completed video for material processing
   * This replaces the old download approach
   */
  async submitCompletedVideo(
    videoTask: VideoGenerationTask,
    options: MaterialVideoSubmissionOptions
  ): Promise<MaterialVideoSubmissionResult> {
    const { productId, materialType, tags, onProgress, onError } = options;
    
    try {
      // Validate tags format
      if (!MaterialSubmissionService.validateTags(tags)) {
        const error = 'Invalid tags format. Only Chinese, English, numbers, and commas are allowed';
        onError?.(error);
        return { success: false, error };
      }

      // Validate video is downloaded (status changed from 'completed' to 'downloaded')
      if (videoTask.status !== 'downloaded' || (!videoTask.relativePath && !videoTask.localPath && !videoTask.videoUrl)) {
        const error = 'Video task is not downloaded or video path is missing';
        onError?.(error);
        return { success: false, error };
      }

      onProgress?.('Preparing material submission...');

      // Always use mp4 file type (1002) as specified
      const materialFileType = 1002; // Fixed to mp4

      // Map material type correctly
      const materialTypeCode = materialType === 'avatar' ? 3001 : 4001; // 3001 for 口播 (avatar), 4001 for 空境 (material)

      // Prepare submission data WITHOUT keyframesUrl (no longer needed in pre-submit)
      const submissionData: MaterialSubmissionData = {
        materialType: materialTypeCode,
        materialFileType,
        productId,
        tags
      };

      onProgress?.('Submitting material information...', { submissionData });

      // Step 1: Get file path and material ID
      const submissionResult = await this.submissionService.preSubmitMaterial(submissionData);
      
      if (submissionResult.code !== 200) {
        const error = `Material submission failed with code: ${submissionResult.code}`;
        onError?.(error);
        return { success: false, error };
      }

      const { filePath, materialId } = submissionResult.data;

      onProgress?.('Received file path and material ID', { filePath, materialId });

      // Step 2: Download keyframe image to server file path
      onProgress?.('Downloading keyframe image to server...');
      
      let keyframeFilePath: string;
      let keyframesUrl: string; // Relative path for status update
      
      try {
        keyframeFilePath = `${filePath}.jpg`; // Append .jpg to video file path
        await this.downloadKeyframeToPath(videoTask, keyframeFilePath, materialType);
        
        // Generate relative path for keyframesUrl (remove Windows drive letter, initial directory, and backslashes)
        const relativePath = keyframeFilePath.replace(/^[A-Z]:\\[^\\]+\\/, '/').replace(/\\/g, '/');
        keyframesUrl = relativePath;
        
        onProgress?.('Keyframe image downloaded successfully', { keyframeFilePath, keyframesUrl });
      } catch (keyframeError) {
        const error = `Failed to download keyframe image: ${keyframeError instanceof Error ? keyframeError.message : 'Unknown error'}`;
        onError?.(error);
        return { success: false, error };
      }

      // Step 3: Place the video file at the specified path
      onProgress?.('Placing video file...', { filePath, sourceFile: videoTask.relativePath || videoTask.localPath || videoTask.videoUrl });

      try {
        const sourceFile = videoTask.relativePath || videoTask.localPath || videoTask.videoUrl;
        
        if (!sourceFile) {
          throw new Error('No source file found in video task');
        }

        // Check if the source is a URL or local file
        if (sourceFile.startsWith('http://') || sourceFile.startsWith('https://')) {
          // Download from URL
          onProgress?.('Downloading video from URL...');
          await this.downloadVideoToPath(sourceFile, filePath);
        } else {
          // Copy local file
          onProgress?.('Copying local video file...');
          await this.copyLocalVideoToPath(sourceFile, filePath);
        }

        onProgress?.('Video file placed successfully at target path');

        // Step 4: Update material status as success WITH keyframesUrl
        onProgress?.('Updating material status to success...');
        const statusResult = await this.submissionService.updateMaterialStatus({
          materialId,
          dealStatus: 1, // Success
          msg: '', // Empty message for success
          keyframesUrl // Include relative path for keyframes
        });

        if (statusResult.code !== 200) {
          const error = `Status update failed with code: ${statusResult.code}`;
          onError?.(error);
          return { success: false, error };
        }

        onProgress?.('Material submission completed successfully!');

        return {
          success: true,
          materialId,
          filePath
        };

      } catch (fileError) {
        // File placement failed, report failure to the API
        const errorMessage = fileError instanceof Error ? fileError.message : 'File placement failed';
        
        onProgress?.('File placement failed, reporting to server...');
        
        try {
          await this.submissionService.updateMaterialStatus({
            materialId,
            dealStatus: 2, // Failure
            msg: `File placement failed: ${errorMessage}`,
            keyframesUrl // Still include keyframes URL even for failure
          });
        } catch (statusError) {
          console.error('Failed to report material failure:', statusError);
        }

        onError?.(errorMessage);
        return { success: false, error: errorMessage };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in material video submission:', error);
      onError?.(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Download keyframe image from video task to server file path
   */
  private async downloadKeyframeToPath(
    videoTask: VideoGenerationTask,
    targetPath: string,
    materialType: 'avatar' | 'material'
  ): Promise<void> {
    try {
      // Find the best available image source
      let imageUrl: string | null = null;
      let imageSource = 'unknown';

      // Priority order: imageUrl (source image) -> previewUrl -> video frame extraction
      if (videoTask.imageUrl) {
        // Use the original source image (highest priority for material videos)
        imageUrl = videoTask.imageUrl;
        imageSource = 'source image (imageUrl)';
        console.log('📸 Using source imageUrl for keyframe:', imageUrl);
      } else if (videoTask.previewUrl) {
        // Use preview/thumbnail image as fallback
        imageUrl = videoTask.previewUrl;
        imageSource = 'preview image (previewUrl)';
        console.log('📸 Using previewUrl for keyframe:', imageUrl);
      } else {
        // Last resort: try to extract from video (not implemented yet)
        if (videoTask.videoUrl) {
          console.warn('⚠️ No source or preview image available, video frame extraction needed');
          throw new Error('No source image (imageUrl) or preview image (previewUrl) available. Video frame extraction is not yet implemented. Please ensure video tasks have the original source image URL.');
        } else {
          throw new Error('No image source available in video task (no imageUrl, previewUrl, or videoUrl)');
        }
      }

      console.log('📸 Downloading keyframe for material submission:', {
        imageUrl,
        targetPath,
        imageSource,
        materialType,
        taskId: videoTask.taskId,
        hasSourceImage: !!videoTask.imageUrl,
        hasPreview: !!videoTask.previewUrl,
        hasVideo: !!videoTask.videoUrl,
        sourceImageName: videoTask.imageName // Original filename for debugging
      });

      // Use the new download keyframe API
      const response = await fetch('/api/download-keyframe-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          targetPath
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download keyframe image');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Keyframe download failed');
      }

      console.log('✅ Keyframe image downloaded to server path:', {
        targetPath,
        fileSize: result.fileSize,
        contentType: result.contentType,
        imageSource
      });

    } catch (error) {
      console.error('❌ Error downloading keyframe to path:', error);
      throw error;
    }
  }

  /**
   * Download video from URL to specified file path
   */
  private async downloadVideoToPath(videoUrl: string, targetPath: string): Promise<void> {
    try {
      console.log('📥 Downloading video from URL to path:', { videoUrl, targetPath });
      
      const response = await fetch('/api/material-download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          targetPath
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download video');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Video download failed');
      }

      console.log('✅ Video downloaded successfully:', result.message);
    } catch (error) {
      console.error('❌ Error downloading video:', error);
      throw error;
    }
  }

  /**
   * Copy local video file to specified file path
   */
  private async copyLocalVideoToPath(sourcePath: string, targetPath: string): Promise<void> {
    try {
      console.log('📋 Copying local video file to path:', { sourcePath, targetPath });
      
      const response = await fetch('/api/copy-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourcePath,
          targetPath
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to copy video');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Video copy failed');
      }

      console.log('✅ Video copied successfully:', result.message);
    } catch (error) {
      console.error('❌ Error copying video:', error);
      throw error;
    }
  }

  /**
   * Submit multiple completed videos for material processing
   */
  async submitMultipleVideos(
    videoTasks: VideoGenerationTask[],
    options: MaterialVideoSubmissionOptions
  ): Promise<MaterialVideoSubmissionResult[]> {
    const results: MaterialVideoSubmissionResult[] = [];
    const completedTasks = videoTasks.filter(task => task.status === 'downloaded' && (task.relativePath || task.localPath || task.videoUrl));

    options.onProgress?.(`Submitting ${completedTasks.length} completed videos...`);

    for (let i = 0; i < completedTasks.length; i++) {
      const task = completedTasks[i];
      const taskOptions = {
        ...options,
        onProgress: (status: string, details?: any) => {
          options.onProgress?.(`[${i + 1}/${completedTasks.length}] ${status}`, details);
        }
      };

      const result = await this.submitCompletedVideo(task, taskOptions);
      results.push(result);

      // Add a small delay between submissions
      if (i < completedTasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Handle failure case for material submission
   */
  async reportMaterialFailure(
    materialId: number,
    errorMessage: string,
    keyframesUrl: string
  ): Promise<boolean> {
    try {
      const result = await this.submissionService.updateMaterialStatus({
        materialId,
        dealStatus: 2, // Failure
        msg: errorMessage,
        keyframesUrl
      });

      return result.code === 200;
    } catch (error) {
      console.error('Error reporting material failure:', error);
      return false;
    }
  }

  /**
   * Extract file extension from URL
   */
  private getFileExtension(url: string): string {
    const urlParts = url.split('?')[0].split('.');
    return urlParts[urlParts.length - 1] || 'mp4';
  }

  /**
   * Generate tags from product and video information
   */
  static generateTags(
    productName: string,
    videoPrompt?: string,
    additionalTags?: string[]
  ): string {
    const tags: string[] = [];

    // Add product name
    if (productName) {
      tags.push(productName);
    }

    // Add video prompt keywords
    if (videoPrompt) {
      // Extract meaningful keywords from prompt
      const keywords = videoPrompt
        .split(' ')
        .filter(word => word.length > 2)
        .slice(0, 3); // Take first 3 keywords
      tags.push(...keywords);
    }

    // Add additional tags
    if (additionalTags) {
      tags.push(...additionalTags);
    }

    return tags.join(',');
  }
}

export default MaterialVideoSubmissionHelper; 