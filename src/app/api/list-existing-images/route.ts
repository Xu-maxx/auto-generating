import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const imagesDir = join(process.cwd(), 'public', 'generated-images');
    
    try {
      const files = await readdir(imagesDir);
      
      // Filter only image files and get their stats
      const imageFiles = [];
      
      for (const file of files) {
        if (file === '.gitkeep') continue; // Skip .gitkeep file
        
        const filePath = join(imagesDir, file);
        const fileStat = await stat(filePath);
        
        // Check if it's a file and has image extension
        if (fileStat.isFile() && /\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
          imageFiles.push({
            id: `existing_${file}`,
            filename: file,
            url: `/generated-images/${file}`,
            selected: false,
            createdAt: fileStat.birthtime,
            size: fileStat.size
          });
        }
      }
      
      // Sort by creation date (newest first)
      imageFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return NextResponse.json({ 
        success: true, 
        images: imageFiles,
        count: imageFiles.length 
      });
      
    } catch (dirError) {
      // Directory doesn't exist or is empty
      console.log('Generated images directory not found or empty:', dirError);
      return NextResponse.json({ 
        success: true, 
        images: [],
        count: 0,
        message: 'No generated images found'
      });
    }
    
  } catch (error) {
    console.error('Error listing existing images:', error);
    return NextResponse.json(
      { error: 'Failed to list existing images' },
      { status: 500 }
    );
  }
} 