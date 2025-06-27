import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Server-side preview extraction using simple frame extraction
const extractPreviewFromVideo = async (videoPath: string, outputPath: string): Promise<boolean> => {
  try {
    // For now, we'll skip server-side extraction as it requires ffmpeg
    // This is a placeholder for future implementation
    console.log('Server-side preview extraction not implemented yet');
    return false;
  } catch (error) {
    console.error('Server-side preview extraction failed:', error);
    return false;
  }
};

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, folderName, originalFilename, taskId, previewDataUrl, originalImageUrl } = await request.json();

    if (!videoUrl || !folderName || !originalFilename) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`🎬 Downloading video for task ${taskId}:`, {
      videoUrl: videoUrl.substring(0, 100) + '...',
      folderName,
      originalFilename,
      hasPreviewData: !!previewDataUrl,
      hasOriginalImageUrl: !!originalImageUrl
    });

    // Create folder structure
    const baseDir = join(process.cwd(), 'public', 'generated-videos', folderName);
    await mkdir(baseDir, { recursive: true });

    // Generate filename
    const timestamp = Date.now();
    const cleanFilename = originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const filename = `${cleanFilename}_${timestamp}.mp4`;
    const filePath = join(baseDir, filename);
    const relativePath = `generated-videos/${folderName}/${filename}`;

    // Download video
    console.log(`📥 Downloading video from: ${videoUrl}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBuffer = await response.arrayBuffer();
    await writeFile(filePath, Buffer.from(videoBuffer));
    console.log(`✅ Video saved to: ${relativePath}`);

    let previewUrl = null;

    // Try to save client-side extracted preview first
    if (previewDataUrl) {
      try {
        const previewDir = join(process.cwd(), 'public', 'generated-videos', 'previews');
        await mkdir(previewDir, { recursive: true });
        
        const previewFilename = `${cleanFilename}_${timestamp}_preview.jpg`;
        const previewPath = join(previewDir, previewFilename);
        const previewRelativePath = `generated-videos/previews/${previewFilename}`;

        // Convert data URL to buffer and save
        const base64Data = previewDataUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid preview data URL format');
        }
        
        const previewBuffer = Buffer.from(base64Data, 'base64');
        await writeFile(previewPath, previewBuffer);
        
        previewUrl = `/${previewRelativePath}`;
        console.log(`✅ Client-side preview saved successfully: ${previewUrl}`);
      } catch (previewError) {
        console.error('❌ Failed to save client-side preview frame:', previewError);
        previewUrl = null; // Will try fallback below
      }
    }

    // If client-side preview failed, use original image as fallback
    if (!previewUrl) {
      if (originalImageUrl) {
        console.log(`🖼️ Using original image as preview fallback: ${originalImageUrl}`);
        previewUrl = originalImageUrl;
      } else {
        console.log(`⚠️ No original image URL available, trying server-side extraction...`);
        try {
          const previewDir = join(process.cwd(), 'public', 'generated-videos', 'previews');
          await mkdir(previewDir, { recursive: true });
          
          const previewFilename = `${cleanFilename}_${timestamp}_preview.jpg`;
          const previewPath = join(previewDir, previewFilename);
          const previewRelativePath = `generated-videos/previews/${previewFilename}`;

          const serverExtractionSuccess = await extractPreviewFromVideo(filePath, previewPath);
          
          if (serverExtractionSuccess) {
            previewUrl = `/${previewRelativePath}`;
            console.log(`✅ Server-side preview extracted: ${previewUrl}`);
          } else {
            console.log(`⚠️ No preview available, using video file as last resort`);
            // Use the video file itself as the last resort
            previewUrl = `/${relativePath}`;
          }
        } catch (serverError) {
          console.error('❌ Server-side preview extraction failed:', serverError);
          // Use the video file itself as final fallback
          previewUrl = `/${relativePath}`;
        }
      }
    }

    const result = {
      success: true,
      message: 'Video downloaded successfully',
      filePath,
      relativePath,
      previewUrl
    };

    console.log(`🎬 Download complete for task ${taskId}:`, {
      relativePath,
      previewUrl,
      previewType: previewUrl === originalImageUrl ? 'original-image' : 
                   previewUrl === `/${relativePath}` ? 'video-fallback' : 'extracted-frame'
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error downloading video:', error);
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    );
  }
} 