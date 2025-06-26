import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { videos } = await request.json();

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    const results = [];
    
    for (const video of videos) {
      try {
        const filesToDelete = [];

        // Add video file to deletion list
        if (video.relativePath) {
          const videoPath = join(process.cwd(), 'public', video.relativePath);
          filesToDelete.push({ path: videoPath, type: 'video' });
        }

        // Add preview file to deletion list
        if (video.previewUrl) {
          const previewPath = join(process.cwd(), 'public', video.previewUrl.replace(/^\//, ''));
          filesToDelete.push({ path: previewPath, type: 'preview' });
        }

        // Delete files
        const deletionResults = [];
        for (const file of filesToDelete) {
          try {
            await unlink(file.path);
            deletionResults.push({ type: file.type, success: true });
            console.log(`Deleted ${file.type}: ${file.path}`);
          } catch (error) {
            console.error(`Failed to delete ${file.type} ${file.path}:`, error);
            deletionResults.push({ 
              type: file.type, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }

        results.push({
          taskId: video.taskId,
          success: deletionResults.every(r => r.success),
          deletionResults
        });

      } catch (error) {
        console.error(`Failed to process video deletion ${video.taskId}:`, error);
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
      message: `${successCount} videos deleted successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results
    });

  } catch (error) {
    console.error('Error deleting videos:', error);
    return NextResponse.json(
      { error: 'Failed to delete videos' },
      { status: 500 }
    );
  }
} 