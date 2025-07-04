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

      // Step 1: Extract and upload keyframe image to OSS
      onProgress?.('Extracting and uploading keyframe image...');
      
      let keyframesUrl: string;
      
      try {
        keyframesUrl = await this.extractAndUploadKeyframe(videoTask, materialType);
        onProgress?.('Keyframe image uploaded successfully', { keyframesUrl });
      } catch (keyframeError) {
        const error = `Failed to upload keyframe image: ${keyframeError instanceof Error ? keyframeError.message : 'Unknown error'}`;
        onError?.(error);
        return { success: false, error };
      }

      // Prepare submission data with keyframesUrl
      const submissionData: MaterialSubmissionData = {
        materialType: materialTypeCode,
        materialFileType,
        productId,
        tags,
        keyframesUrl
      };

      onProgress?.('Submitting material information...', { submissionData });

      // Step 2: Get file path and material ID
      const submissionResult = await this.submissionService.preSubmitMaterial(submissionData);
      
      if (submissionResult.code !== 200) {
        const error = `Material submission failed with code: ${submissionResult.code}`;
        onError?.(error);
        return { success: false, error };
      }

      const { filePath, materialId } = submissionResult.data;

      onProgress?.('Received file path and material ID', { filePath, materialId });

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

        // Step 4: Update material status as success
        onProgress?.('Updating material status to success...');
        const statusResult = await this.submissionService.updateMaterialStatus({
          materialId,
          dealStatus: 1, // Success
          msg: '' // Empty message for success
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
            msg: `File placement failed: ${errorMessage}`
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
   * Extract keyframe image from video task and upload to OSS
   */
  private async extractAndUploadKeyframe(
    videoTask: VideoGenerationTask,
    materialType: 'avatar' | 'material'
  ): Promise<string> {
    try {
      // Find the best available image source
      let imageUrl: string | null = null;
      let imageName = `${materialType}-keyframe-${Date.now()}`;
      let imageSource = 'unknown';

      // Priority order: imageUrl (source image) -> previewUrl -> video frame extraction
      if (videoTask.imageUrl) {
        // Use the original source image (highest priority for material videos)
        imageUrl = videoTask.imageUrl;
        imageName = `${materialType}-source-${videoTask.taskId || Date.now()}`;
        imageSource = 'source image (imageUrl)';
        console.log('📸 Using source imageUrl for keyframe:', imageUrl);
      } else if (videoTask.previewUrl) {
        // Use preview/thumbnail image as fallback
        imageUrl = videoTask.previewUrl;
        imageName = `${materialType}-preview-${videoTask.taskId || Date.now()}`;
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

      console.log('📸 Extracting keyframe for material submission:', {
        imageUrl,
        imageName,
        imageSource,
        materialType,
        taskId: videoTask.taskId,
        hasSourceImage: !!videoTask.imageUrl,
        hasPreview: !!videoTask.previewUrl,
        hasVideo: !!videoTask.videoUrl,
        sourceImageName: videoTask.imageName // Original filename for debugging
      });

      // Check if this is an external URL that might cause CORS issues
      const isExternalUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
      const isLocalUrl = imageUrl.startsWith('/') || imageUrl.includes('localhost');
      
      let imageBlob: Blob;
      let contentType: string;

      if (isExternalUrl && !isLocalUrl) {
        // Use proxy API for external URLs to avoid CORS issues
        console.log('🔄 Using proxy API for external image URL');
        
        try {
          const proxyResponse = await fetch('/api/proxy-image-download', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
          });

          if (!proxyResponse.ok) {
            const errorData = await proxyResponse.json();
            throw new Error(errorData.error || 'Proxy download failed');
          }

          const proxyResult = await proxyResponse.json();
          
          if (!proxyResult.success || !proxyResult.dataUrl) {
            throw new Error('Proxy download failed - no data URL returned');
          }

          // Convert data URL back to blob
          const response = await fetch(proxyResult.dataUrl);
          imageBlob = await response.blob();
          contentType = proxyResult.contentType || 'image/jpeg';

          console.log('✅ Image downloaded via proxy:', {
            originalSize: proxyResult.size,
            blobSize: imageBlob.size,
            contentType
          });

        } catch (proxyError) {
          throw new Error(`Failed to download external image via proxy: ${proxyError instanceof Error ? proxyError.message : 'Unknown proxy error'}`);
        }
      } else {
        // Direct download for local/same-origin URLs
        console.log('📥 Direct download for local/same-origin URL');
        
        const imageResponse = await fetch(imageUrl);
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to download keyframe image from ${imageSource}: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        imageBlob = await imageResponse.blob();
        contentType = imageBlob.type || 'image/jpeg';
      }

      // Check if the response is actually an image
      if (!contentType.startsWith('image/')) {
        // If it's not an image (e.g., video), we need to handle it differently
        if (contentType.startsWith('video/')) {
          console.log(`📹 Downloaded content from ${imageSource} is a video, not an image`);
          throw new Error(`Expected image but got video content from ${imageSource}. Please ensure video tasks have proper source image URLs.`);
        } else {
          throw new Error(`Unexpected content type from ${imageSource}: ${contentType}`);
        }
      }

      // Determine file extension
      const extension = contentType.split('/')[1] || 'jpg';
      const filename = `${imageName}.${extension}`;

      // Create File object for upload
      const imageFile = new File([imageBlob], filename, { type: contentType });

      console.log('📤 Uploading keyframe image to OSS:', {
        filename,
        size: imageFile.size,
        type: imageFile.type,
        source: imageSource
      });

      // Upload to OSS
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('originalFilename', filename);

      const uploadResponse = await fetch('/api/upload-to-oss', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload keyframe to OSS');
      }

      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('OSS upload failed - no URL returned');
      }

      console.log('✅ Keyframe image uploaded to OSS:', {
        originalUrl: imageUrl,
        imageSource: imageSource,
        ossUrl: uploadResult.url,
        filename: uploadResult.filename,
        size: uploadResult.size
      });

      return uploadResult.url;

    } catch (error) {
      console.error('❌ Error extracting and uploading keyframe:', error);
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
    errorMessage: string
  ): Promise<boolean> {
    try {
      const result = await this.submissionService.updateMaterialStatus({
        materialId,
        dealStatus: 2, // Failure
        msg: errorMessage
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