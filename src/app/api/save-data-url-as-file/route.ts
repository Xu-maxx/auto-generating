import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataUrl, targetPath } = body;

    console.log('📥 Save data URL as file request:', {
      dataUrlLength: dataUrl?.length,
      targetPath,
      dataUrlType: dataUrl?.substring(0, 50) + '...'
    });

    if (!dataUrl || !targetPath) {
      return NextResponse.json(
        { error: 'Missing required fields: dataUrl, targetPath' },
        { status: 400 }
      );
    }

    try {
      // Create target directory if it doesn't exist
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });

      // Parse the data URL
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      // Validate that it's an image
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Data URL is not an image: ${mimeType}`);
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Write image to target path
      await fs.writeFile(targetPath, imageBuffer);

      console.log('✅ Data URL saved as file successfully:', {
        targetPath,
        fileSize: imageBuffer.byteLength,
        contentType: mimeType
      });

      return NextResponse.json({
        success: true,
        message: 'Data URL saved as file successfully',
        targetPath,
        fileSize: imageBuffer.byteLength,
        contentType: mimeType
      });

    } catch (saveError) {
      console.error('❌ Error saving data URL as file:', saveError);
      return NextResponse.json(
        { 
          success: false,
          error: saveError instanceof Error ? saveError.message : 'Unknown save error' 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in save data URL as file API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 