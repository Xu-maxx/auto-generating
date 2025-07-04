import { NextRequest, NextResponse } from 'next/server';
import { copyFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { sourcePath, targetPath } = await request.json();

    if (!sourcePath || !targetPath) {
      return NextResponse.json(
        { success: false, error: 'sourcePath and targetPath are required' },
        { status: 400 }
      );
    }

    console.log('📋 Copying local video file for material submission:', sourcePath);
    console.log('📁 Target path:', targetPath);

    // Resolve the source path (handle relative paths)
    let resolvedSourcePath = sourcePath;
    
    // If source path is relative (starts with / or ./), resolve it relative to public folder
    if (sourcePath.startsWith('/') || sourcePath.startsWith('./')) {
      resolvedSourcePath = resolve(process.cwd(), 'public', sourcePath.replace(/^\//, ''));
    } else if (!sourcePath.startsWith('C:') && !sourcePath.startsWith('/')) {
      // If it's not an absolute path, treat it as relative to public folder
      resolvedSourcePath = resolve(process.cwd(), 'public', sourcePath);
    }

    // Check if source file exists
    if (!existsSync(resolvedSourcePath)) {
      return NextResponse.json(
        { success: false, error: `Source file not found: ${resolvedSourcePath}` },
        { status: 404 }
      );
    }

    // Create target directory if it doesn't exist
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
      console.log('📁 Created directory:', targetDir);
    }

    // Copy the video file
    await copyFile(resolvedSourcePath, targetPath);

    console.log('✅ Video copied successfully for material submission:', targetPath);
    console.log('🔄 From:', resolvedSourcePath);
    console.log('📍 To:', targetPath);

    return NextResponse.json({
      success: true,
      message: `Video copied successfully to ${targetPath}`,
      sourcePath: resolvedSourcePath,
      targetPath: targetPath
    });

  } catch (error) {
    console.error('❌ Error copying video for material submission:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy video'
      },
      { status: 500 }
    );
  }
} 