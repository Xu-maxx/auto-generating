import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join, extname, basename } from 'path';
import { existsSync } from 'fs';

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
    const requestBody = await request.json();
    const { 
      videoUrl, 
      folderName, 
      originalFilename, 
      taskId, 
      previewDataUrl, 
      originalImageUrl,
      targetPath // For backward compatibility
    } = requestBody;

    // Support both old format (videoUrl + targetPath) and new format (videoUrl + folderName + etc.)
    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: 'videoUrl is required' },
        { status: 400 }
      );
    }

    let finalTargetPath: string;
    let relativePath: string;

    // If targetPath is provided directly (old format), use it
    if (targetPath) {
      finalTargetPath = targetPath;
      relativePath = targetPath.replace(process.cwd(), '').replace(/\\/g, '/');
    } else {
      // New format: construct path from folderName and other parameters
      if (!folderName || !originalFilename || !taskId) {
        return NextResponse.json(
          { success: false, error: 'folderName, originalFilename, and taskId are required' },
          { status: 400 }
        );
      }

      // Create downloads directory structure (same as downloadUtils.ts but in public folder)
      const downloadsDir = join(process.cwd(), 'public', 'downloads');
      const folderDir = join(downloadsDir, folderName);
      
      // Generate filename with timestamp and task ID (same as downloadUtils.ts)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = extname(originalFilename) || '.mp4';
      const baseFilename = basename(originalFilename, fileExtension);
      const filename = `${baseFilename}_${timestamp}_${taskId.substring(0, 8)}${fileExtension}`;
      
      finalTargetPath = join(folderDir, filename);
      relativePath = join('downloads', folderName, filename).replace(/\\/g, '/');
    }

    console.log('📥 Downloading video from URL:', videoUrl);
    console.log('📁 Target path:', finalTargetPath);
    console.log('📍 Relative path:', relativePath);

    // Validate URL
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'Invalid video URL' },
        { status: 400 }
      );
    }

    // Create directory if it doesn't exist
    const targetDir = dirname(finalTargetPath);
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
      console.log('📁 Created directory:', targetDir);
    }

    // Download the video
    const response = await fetch(videoUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    const videoBuffer = await response.arrayBuffer();
    const videoData = new Uint8Array(videoBuffer);

    // Write the video to the target path
    await writeFile(finalTargetPath, videoData);

    console.log('✅ Video downloaded successfully:', finalTargetPath);
    console.log('📊 File size:', videoData.length, 'bytes');

    // Handle preview data URL if provided
    let previewPath: string | null = null;
    if (previewDataUrl) {
      try {
        const previewDir = join(process.cwd(), 'public', 'generated-images');
        if (!existsSync(previewDir)) {
          await mkdir(previewDir, { recursive: true });
        }
        
        const previewFilename = `${basename(finalTargetPath, extname(finalTargetPath))}_preview.jpg`;
        previewPath = join(previewDir, previewFilename);
        
        // Extract base64 data from data URL
        const base64Data = previewDataUrl.split(',')[1];
        const previewBuffer = Buffer.from(base64Data, 'base64');
        
        await writeFile(previewPath, previewBuffer);
        console.log('✅ Preview image saved:', previewPath);
      } catch (previewError) {
        console.error('⚠️ Failed to save preview image:', previewError);
        // Don't fail the whole request if preview fails
      }
    }

    // Generate preview URL (prefer extracted frame, fallback to original image, then video)
    let previewUrl: string;
    if (previewPath) {
      previewUrl = `/generated-images/${basename(previewPath)}`;
    } else if (originalImageUrl) {
      previewUrl = originalImageUrl;
    } else {
      previewUrl = `/${relativePath}`;
    }

    return NextResponse.json({
      success: true,
      message: `Video downloaded successfully to ${finalTargetPath}`,
      filePath: finalTargetPath,
      relativePath: relativePath,
      previewUrl: previewUrl,
      fileSize: videoData.length
    });

  } catch (error) {
    console.error('❌ Error downloading video:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download video'
      },
      { status: 500 }
    );
  }
} 