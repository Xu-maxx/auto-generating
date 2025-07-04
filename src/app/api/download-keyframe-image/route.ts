import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, targetPath } = body;

    console.log('📥 Download keyframe image request:', {
      imageUrl: imageUrl?.substring(0, 100) + (imageUrl?.length > 100 ? '...' : ''),
      targetPath
    });

    if (!imageUrl || !targetPath) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl, targetPath' },
        { status: 400 }
      );
    }

    try {
      // Create target directory if it doesn't exist
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });

      // Download the image
      let imageResponse: Response;
      
      // Check if this is an external URL that might cause CORS issues
      const isExternalUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
      const isRelativePath = imageUrl.startsWith('/') && !isExternalUrl;
      
      if (isExternalUrl) {
        // Use proxy for external URLs
        console.log('🔄 Using proxy for external URL');
        
        // Construct full URL for internal API call
        const origin = request.headers.get('origin') || 
                      request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                      'http://localhost:3000';
        const proxyUrl = `${origin}/api/proxy-image-download`;
        
        console.log('🔄 Calling proxy API at:', proxyUrl);
        
        const proxyResponse = await fetch(proxyUrl, {
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

        // Convert data URL to response
        imageResponse = await fetch(proxyResult.dataUrl);
      } else if (isRelativePath) {
        // Handle relative paths by constructing full URL
        console.log('🔄 Constructing full URL for relative path');
        
        // Get the origin from the request - try multiple methods
        let origin = request.headers.get('origin') || 
                    request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                    'http://localhost:3000';
        
        // If the path is for a static file (like /generated-images/...), check if it exists in public directory
        if (imageUrl.startsWith('/generated-images/')) {
          const publicFilePath = path.join(process.cwd(), 'public', imageUrl);
          console.log('🔍 Checking for static file at:', publicFilePath);
          
          try {
            // Check if file exists in public directory
            await fs.access(publicFilePath);
            console.log('✅ Found static file, reading directly from filesystem');
            
            // Read file directly from filesystem
            const imageBuffer = await fs.readFile(publicFilePath);
            
            // Write to target path
            await fs.writeFile(targetPath, imageBuffer);
            
            console.log('✅ Keyframe image copied from static file:', {
              targetPath,
              fileSize: imageBuffer.byteLength,
              sourceFile: publicFilePath
            });

            return NextResponse.json({
              success: true,
              message: 'Keyframe image copied from static file',
              targetPath,
              fileSize: imageBuffer.byteLength,
              contentType: 'image/jpeg' // Assume JPEG for now
            });
          } catch (fsError) {
            console.log('ℹ️ Static file not found, falling back to HTTP fetch');
          }
        }
        
        const fullUrl = `${origin}${imageUrl}`;
        
        console.log('📥 Constructed full URL:', fullUrl);
        
        imageResponse = await fetch(fullUrl);
      } else {
        // Direct download for other URLs
        console.log('📥 Direct download for local/same-origin URL');
        imageResponse = await fetch(imageUrl);
      }

      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Check content type
      const contentType = imageResponse.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Downloaded content is not an image: ${contentType}`);
      }

      // Write image to target path
      await fs.writeFile(targetPath, Buffer.from(imageBuffer));

      console.log('✅ Keyframe image downloaded successfully:', {
        targetPath,
        fileSize: imageBuffer.byteLength,
        contentType
      });

      return NextResponse.json({
        success: true,
        message: 'Keyframe image downloaded successfully',
        targetPath,
        fileSize: imageBuffer.byteLength,
        contentType
      });

    } catch (downloadError) {
      console.error('❌ Error downloading keyframe image:', downloadError);
      return NextResponse.json(
        { 
          success: false,
          error: downloadError instanceof Error ? downloadError.message : 'Unknown download error' 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in download keyframe image API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 