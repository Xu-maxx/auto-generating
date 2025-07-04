import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, targetPath } = await request.json();

    if (!videoUrl || !targetPath) {
      return NextResponse.json(
        { success: false, error: 'videoUrl and targetPath are required' },
        { status: 400 }
      );
    }

    console.log('📥 Downloading video from URL for material submission:', videoUrl);
    console.log('📁 Target path:', targetPath);

    // Validate URL
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'Invalid video URL' },
        { status: 400 }
      );
    }

    // Create directory if it doesn't exist
    const targetDir = dirname(targetPath);
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
    await writeFile(targetPath, videoData);

    console.log('✅ Video downloaded successfully for material submission:', targetPath);
    console.log('📊 File size:', videoData.length, 'bytes');

    return NextResponse.json({
      success: true,
      message: `Video downloaded successfully to ${targetPath}`,
      filePath: targetPath,
      fileSize: videoData.length
    });

  } catch (error) {
    console.error('❌ Error downloading video for material submission:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download video'
      },
      { status: 500 }
    );
  }
} 