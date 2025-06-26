import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, folderName, originalFilename, taskId, extractPreview } = await request.json();

    if (!videoUrl || !folderName || !originalFilename) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

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
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const videoBuffer = await response.arrayBuffer();
    await writeFile(filePath, Buffer.from(videoBuffer));

    let previewUrl = null;

    // Extract preview frame if requested
    if (extractPreview) {
      try {
        const previewDir = join(process.cwd(), 'public', 'generated-videos', 'previews');
        await mkdir(previewDir, { recursive: true });
        
        const previewFilename = `${cleanFilename}_${timestamp}_preview.jpg`;
        const previewPath = join(previewDir, previewFilename);
        const previewRelativePath = `generated-videos/previews/${previewFilename}`;

        // Use ffmpeg to extract the first frame
        await execAsync(`ffmpeg -i "${filePath}" -vframes 1 -f image2 "${previewPath}"`);
        
        previewUrl = `/${previewRelativePath}`;
        console.log(`Preview extracted successfully: ${previewUrl}`);
      } catch (previewError) {
        console.error('Failed to extract preview frame:', previewError);
        // Don't fail the whole operation if preview extraction fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Video downloaded successfully',
      filePath,
      relativePath,
      previewUrl
    });

  } catch (error) {
    console.error('Error downloading video:', error);
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 }
    );
  }
} 