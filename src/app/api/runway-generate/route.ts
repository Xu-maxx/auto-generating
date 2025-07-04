import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { toRunwayRatio } from '@/utils/imageRatioUtils';

interface GeneratedImage {
  taskId: string;
  filename: string;
  url: string;
  prompt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { promptText, imageCount = 4, referenceImages = [], aspectRatio = '16:9', resolution = {width: 1920, height: 1080} } = await request.json();

    console.log('Runway API request:', { 
      promptText: promptText?.substring(0, 100), 
      imageCount,
      referenceImagesCount: referenceImages.length,
      aspectRatio,
      resolution,
      resolutionType: typeof resolution
    });

    if (!promptText) {
      return NextResponse.json({ error: 'No prompt text provided' }, { status: 400 });
    }

    if (!process.env.RUNWAY_API_KEY) {
      console.error('Missing RUNWAY_API_KEY environment variable');
      return NextResponse.json({ error: 'Runway API key not configured' }, { status: 500 });
    }

    console.log('Using Runway API key:', process.env.RUNWAY_API_KEY?.substring(0, 10) + '...');

    const taskIds: string[] = [];

    // Generate multiple images by creating multiple tasks
    for (let i = 0; i < imageCount; i++) {
      console.log(`Creating task ${i + 1}/${imageCount}`);
      
      // Convert the ratio with better error handling
      let runwayRatio;
      try {
        runwayRatio = toRunwayRatio(aspectRatio, resolution);
        console.log(`Converted ratio for task ${i + 1}:`, { aspectRatio, resolution, runwayRatio });
      } catch (ratioError) {
        console.error('Error converting ratio:', ratioError);
        return NextResponse.json({ 
          error: 'Invalid aspect ratio or resolution format',
          details: { aspectRatio, resolution, error: ratioError instanceof Error ? ratioError.message : 'Unknown error' }
        }, { status: 400 });
      }
      
      // Build request body with reference images if provided
      const requestBody: any = {
        promptText: promptText,
        ratio: runwayRatio,
        model: 'gen4_image',
        seed: Math.floor(Math.random() * 4294967295), // Random seed for variation
      };

      // Add reference images if provided
      if (referenceImages && referenceImages.length > 0) {
        console.log(`Adding ${referenceImages.length} reference images to task ${i + 1}`);
        
        const validReferenceImages = [];
        
        for (let index = 0; index < referenceImages.length; index++) {
          const refImg = referenceImages[index];
          // Use extracted frame for videos, otherwise use the original URL
          const imageUrl = refImg.isVideo && refImg.extractedFrame ? refImg.extractedFrame : refImg.url;
          
          // Validate the image URL
          if (!imageUrl || imageUrl.trim() === '') {
            console.warn(`Skipping reference image ${index + 1}: No valid URL found`);
            continue;
          }
          
          // Check if it's a valid URL or data URI
          const isValidUrl = imageUrl.startsWith('http://') || 
                            imageUrl.startsWith('https://') || 
                            imageUrl.startsWith('data:image/');
          
          if (!isValidUrl) {
            console.warn(`Skipping reference image ${index + 1}: Invalid URL format: ${imageUrl.substring(0, 50)}...`);
            continue;
          }
          
          validReferenceImages.push({
            uri: imageUrl,
            tag: `ref${validReferenceImages.length + 1}` // Use validReferenceImages length for sequential numbering
          });
        }
        
        if (validReferenceImages.length > 0) {
          requestBody.referenceImages = validReferenceImages;
          console.log(`Using ${validReferenceImages.length} valid reference images out of ${referenceImages.length} provided`);
          console.log('Reference images formatted for Runway API:', validReferenceImages.map(img => ({ 
            tag: img.tag, 
            uriLength: img.uri.length,
            uriType: img.uri.startsWith('data:') ? 'base64' : 'url'
          })));
        } else {
          console.warn('No valid reference images found, proceeding without reference images');
        }
      }
      
      console.log(`Task ${i + 1} request body:`, {
        promptText: requestBody.promptText?.substring(0, 100) + '...',
        ratio: requestBody.ratio,
        model: requestBody.model,
        seed: requestBody.seed,
        referenceImagesCount: requestBody.referenceImages?.length || 0
      });
      
      const response = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`Task ${i + 1} response status:`, response.status, response.statusText);

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get('content-type');
        
        console.log('Error response headers:', Object.fromEntries(response.headers.entries()));
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
            console.log('Runway API JSON error response:', errorData);
          } catch (e) {
            console.log('Failed to parse JSON error response:', e);
            errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
          }
        } else {
          // Handle non-JSON responses (like HTML error pages)
          const textResponse = await response.text();
          console.error('Runway API returned non-JSON response:', textResponse.substring(0, 500));
          errorData = { 
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: 'Received HTML response instead of JSON - check API key and endpoint'
          };
        }
        
        console.error('Runway API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestBody: {
            ...requestBody,
            // Don't log the full image URLs to keep logs clean
            referenceImages: requestBody.referenceImages?.map((img: any) => ({ 
              tag: img.tag, 
              uriLength: img.uri?.length || 0,
              uriType: img.uri?.startsWith('data:') ? 'base64' : 'url'
            }))
          }
        });
        
        return NextResponse.json({ 
          error: `Runway API error: ${errorData.message || 'Unknown error'}`,
          details: errorData
        }, { status: response.status });
      }

      const data = await response.json();
      taskIds.push(data.id);
    }

    // Poll for completion and download images
    const completedImages: GeneratedImage[] = [];
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();

    console.log(`📊 Starting to poll ${taskIds.length} tasks for completion...`);

    while (completedImages.length < imageCount && (Date.now() - startTime) < maxWaitTime) {
      console.log(`🔄 Poll cycle: ${completedImages.length}/${imageCount} completed, elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s`);
      
      for (let i = 0; i < taskIds.length; i++) {
        const taskId = taskIds[i];
        
        if (completedImages.find(img => img.taskId === taskId)) {
          continue; // Skip already completed tasks
        }

        console.log(`📋 Checking status for task ${taskId}...`);
        
        const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
            'X-Runway-Version': '2024-11-06',
          },
        });

        if (statusResponse.ok) {
          const taskData = await statusResponse.json();
          console.log(`📋 Task ${taskId} status: ${taskData.status}`);
          
          if (taskData.status === 'SUCCEEDED' && taskData.output) {
            console.log(`✅ Task ${taskId} succeeded, downloading image...`);
            // Download and save the image
            const imageUrl = taskData.output[0]; // First output image
            const imageResponse = await fetch(imageUrl);
            
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const timestamp = Date.now();
              const filename = `runway_${taskId}_${timestamp}.jpg`;
              
              // Ensure the images directory exists
              const imagesDir = join(process.cwd(), 'public', 'generated-images');
              try {
                await mkdir(imagesDir, { recursive: true });
              } catch (err) {
                console.log('📁 Images directory already exists or creation failed:', err);
              }
              
              const filepath = join(imagesDir, filename);
              await writeFile(filepath, Buffer.from(imageBuffer));
              
              console.log(`💾 Image saved: ${filename} (${imageBuffer.byteLength} bytes)`);
              
              completedImages.push({
                taskId,
                filename,
                url: `/generated-images/${filename}`,
                prompt: promptText
              });
            } else {
              console.error(`❌ Failed to download image for task ${taskId}:`, imageResponse.status, imageResponse.statusText);
            }
          } else if (taskData.status === 'FAILED') {
            console.error(`❌ Task ${taskId} failed:`, taskData.failure);
          } else {
            console.log(`⏳ Task ${taskId} still in progress (${taskData.status})`);
          }
        } else {
          console.error(`❌ Failed to check status for task ${taskId}:`, statusResponse.status, statusResponse.statusText);
        }
      }

      if (completedImages.length < imageCount) {
        console.log(`⏸️ Waiting ${pollInterval}ms before next poll...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    console.log(`🏁 Polling completed: ${completedImages.length}/${imageCount} images generated in ${Math.floor((Date.now() - startTime) / 1000)}s`);

    return NextResponse.json({ 
      success: true,
      images: completedImages,
      totalGenerated: completedImages.length,
      requested: imageCount
    });

  } catch (error) {
    console.error('Error generating images:', error);
    return NextResponse.json(
      { error: 'Failed to generate images' },
      { status: 500 }
    );
  }
} 