import { NextRequest, NextResponse } from 'next/server';
import { copyFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { videos, targetFolderPath } = await request.json();

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    if (!targetFolderPath || !targetFolderPath.trim()) {
      return NextResponse.json({ error: 'Target folder path is required' }, { status: 400 });
    }

    // Ensure target directory exists
    await mkdir(targetFolderPath, { recursive: true });

    const results = [];
    
    for (const video of videos) {
      try {
        if (!video.relativePath) {
          results.push({
            taskId: video.taskId,
            success: false,
            error: 'No relative path found for video'
          });
          continue;
        }

        // Source file path (in public directory)
        const sourcePath = join(process.cwd(), 'public', video.relativePath);
        
        // Target file path
        const fileName = basename(video.relativePath);
        const targetPath = join(targetFolderPath, fileName);

        // Copy file to target folder
        await copyFile(sourcePath, targetPath);

        results.push({
          taskId: video.taskId,
          success: true,
          sourcePath: sourcePath,
          targetPath: targetPath,
          fileName: fileName
        });

        console.log(`Video stored: ${fileName} -> ${targetPath}`);
      } catch (error) {
        console.error(`Failed to store video ${video.taskId}:`, error);
        results.push({
          taskId: video.taskId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      message: `${successCount} videos stored successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results,
      targetFolderPath
    });

  } catch (error) {
    console.error('Error storing videos:', error);
    return NextResponse.json(
      { error: 'Failed to store videos' },
      { status: 500 }
    );
  }
} 