import { NextRequest, NextResponse } from 'next/server';
import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Simple UUID generator using crypto (with fallback for older Node.js versions)
const generateUUID = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // Fallback for older Node.js versions
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// VolcEngine ARK API configuration
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

// Type definitions for VolcEngine content generation
interface ContentTextItem {
  type: "text";
  text: string;
}

interface ContentImageItem {
  type: "image_url";
  image_url: {
    url: string;
  };
}

type ContentItem = ContentTextItem | ContentImageItem;

// Initialize OSS client
const getOSSClient = () => {
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou';
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET_NAME;

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS credentials not configured. Please set OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and OSS_BUCKET_NAME in your environment variables.');
  }

  return new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    authorizationV4: true
  });
};

// Upload local image to OSS and return public URL
const uploadImageToOSS = async (localImageUrl: string, filename: string): Promise<string> => {
  try {
    const client = getOSSClient();
    
    // Clean the local image URL - remove leading slash if present
    const cleanLocalUrl = localImageUrl.startsWith('/') ? localImageUrl.substring(1) : localImageUrl;
    
    // Read local image file
    const imagePath = path.join(process.cwd(), 'public', cleanLocalUrl);
    
    console.log('OSS Upload - Path construction:', {
      originalUrl: localImageUrl,
      cleanedUrl: cleanLocalUrl,
      finalPath: imagePath,
      pathExists: fs.existsSync(imagePath)
    });
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Local image file not found: ${imagePath}`);
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const fileExtension = filename.split('.').pop() || 'jpg';
    const uniqueFilename = `volcengine-images/${generateUUID()}-${Date.now()}.${fileExtension}`;
    
    console.log('Uploading local image to OSS:', {
      localPath: imagePath,
      ossPath: uniqueFilename,
      size: imageBuffer.length
    });
    
    // Upload to OSS
    const result = await client.put(uniqueFilename, imageBuffer, {
      headers: {
        'Content-Type': `image/${fileExtension}`,
        'Cache-Control': 'public, max-age=31536000'
      }
    });
    
    // Generate public URL
    const publicUrl = `https://${process.env.OSS_BUCKET_NAME}.${process.env.OSS_REGION || 'oss-cn-hangzhou'}.aliyuncs.com/${uniqueFilename}`;
    
    console.log('Image uploaded to OSS successfully:', {
      ossResult: result.name,
      publicUrl: publicUrl
    });
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to OSS:', error);
    throw error;
  }
};

interface VolcEngineVideoRequest {
  prompt: string;
  images: Array<{
    url: string;
    filename: string;
  }>;
  folderName: string;
  aspectRatio?: string;
  seed?: number;
  duration?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: VolcEngineVideoRequest = await request.json();
    const { prompt, images, folderName, aspectRatio = '16:9', seed = -1, duration = 5 } = body;

    const volcEngineApiKey = process.env.VOLCENGINE_API_KEY;

    if (!volcEngineApiKey) {
      return NextResponse.json(
        { error: 'VolcEngine API key not found' },
        { status: 500 }
      );
    }

    // Check OSS configuration
    const ossConfigured = process.env.OSS_ACCESS_KEY_ID && 
                         process.env.OSS_ACCESS_KEY_SECRET && 
                         process.env.OSS_BUCKET_NAME;
    
    console.log('OSS Configuration Status:', {
      configured: ossConfigured,
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      bucket: process.env.OSS_BUCKET_NAME || 'not configured'
    });

    const tasks = [];
    
    console.log(`Processing all ${images.length} images simultaneously...`);
    
    // Process all images simultaneously
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      console.log(`\n=== Processing image ${i + 1}: ${image.filename} ===`);
      console.log('📊 Image details:', {
        filename: image.filename,
        originalUrl: image.url,
        isLocalPath: image.url.startsWith('/'),
        includesLocalhost: image.url.includes('localhost'),
        startsWithHttp: image.url.startsWith('http'),
        urlLength: image.url.length
      });
      
      let imageUrl = image.url;
      
      // Check if image URL is local and needs to be uploaded to OSS
      if (image.url.startsWith('/') || image.url.includes('localhost')) {
        console.log('🔍 Local image detected, uploading to OSS:', {
          originalUrl: image.url,
          filename: image.filename,
          ossConfigured: ossConfigured
        });
        
        if (!ossConfigured) {
          console.error('❌ OSS not configured but local image detected');
          tasks.push({
            taskId: null,
            imageIndex: i,
            imageName: image.filename,
            status: 'failed',
            error: 'OSS not configured for local image upload'
          });
          continue;
        }
        
        try {
          const originalImageUrl = imageUrl;
          imageUrl = await uploadImageToOSS(image.url, image.filename);
          console.log('✅ Successfully uploaded to OSS:', {
            originalUrl: originalImageUrl,
            newUrl: imageUrl,
            isValidUrl: imageUrl.startsWith('https://')
          });
        } catch (error) {
          console.error('❌ Failed to upload image to OSS:', error);
          tasks.push({
            taskId: null,
            imageIndex: i,
            imageName: image.filename,
            status: 'failed',
            error: `Failed to upload image to OSS: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          continue;
        }
      } else {
        console.log('🌐 Using provided public URL:', imageUrl);
      }

      // Prepare content array for VolcEngine API
      const content: ContentItem[] = [
        {
          type: "text",
          text: `${prompt} --resolution 720p --duration ${duration} --ratio ${aspectRatio} --watermark true --camerafixed false${seed !== -1 ? ` --seed ${seed}` : ''}`
        }
      ];

      // Determine model and content based on whether we have an image
      let modelId: string;
      let ratioParam: string;
      const isImageToVideo = imageUrl && imageUrl !== '';
      
      if (isImageToVideo) {
        // Image-to-video: use i2v model and include image
        modelId = "doubao-seedance-1-0-lite-i2v-250428";
        ratioParam = "adaptive"; // For i2v, only adaptive and keep_ratio are supported
        content.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        });
      } else {
        // Text-to-video: use t2v model, no image
        modelId = "doubao-seedance-1-0-lite-t2v-250428";
        ratioParam = aspectRatio; // For t2v, we can use specific ratios like 16:9, 9:16 etc.
      }

      // Update the text content with the correct ratio
      (content[0] as ContentTextItem).text = `${prompt} --resolution 720p --duration ${duration} --ratio ${ratioParam} --watermark true --camerafixed false${seed !== -1 ? ` --seed ${seed}` : ''}`;

      // Prepare request data for VolcEngine content generation API
      const requestData = {
        model: modelId,
        content: content
      };

      console.log('🚀 Final VolcEngine API request details:', {
        model: requestData.model,
        processingType: isImageToVideo ? 'Image-to-Video' : 'Text-to-Video',
        imageUrl: imageUrl,
        imageUrlType: imageUrl.startsWith('https://') ? 'public' : 'local',
        prompt: prompt,
        aspectRatio: aspectRatio,
        actualRatio: ratioParam,
        duration: duration
      });
      console.log('📤 VolcEngine request payload:', JSON.stringify(requestData, null, 2));

      try {
        // Submit task to VolcEngine ARK API
        const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${volcEngineApiKey}`
          },
          body: JSON.stringify(requestData)
        });

        console.log(`VolcEngine API response status for image ${i + 1}:`, response.status);
        console.log(`VolcEngine API response headers for image ${i + 1}:`, Object.fromEntries(response.headers.entries()));
        
        // Check if response has content
        const responseText = await response.text();
        console.log(`VolcEngine API response text for image ${i + 1}:`, responseText);
        
        let result;
        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error(`Failed to parse JSON response for image ${i + 1}:`, parseError);
          result = { error: { message: `Invalid JSON response: ${responseText}` } };
        }
        
        console.log(`VolcEngine API response for image ${i + 1}:`, result);
        
        // VolcEngine API returns success with task ID
        if (response.ok && result.id) {
          console.log(`✅ Successfully submitted task ${result.id} for image ${i + 1}`);
          tasks.push({
            taskId: result.id,
            imageIndex: i,
            imageName: image.filename,
            status: 'submitted',
            prompt: prompt,
            imageUrl: imageUrl // Store the processed image URL for later use
          });
        } else {
          console.error(`❌ VolcEngine API error for image ${i + 1}:`, result);
          const errorMessage = result.error?.message || result.message || result.error || `HTTP ${response.status}: ${responseText}`;
          tasks.push({
            taskId: null,
            imageIndex: i,
            imageName: image.filename,
            status: 'failed',
            error: errorMessage
          });
        }
      } catch (error) {
        console.error(`❌ Error submitting image ${i + 1} to VolcEngine API:`, error);
        tasks.push({
          taskId: null,
          imageIndex: i,
          imageName: image.filename,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const submittedTasks = tasks.filter(t => t.status === 'submitted');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    console.log(`\n=== PROCESSING SUMMARY ===`);
    console.log(`Total images: ${images.length}`);
    console.log(`Successfully submitted: ${submittedTasks.length}`);
    console.log(`Failed: ${failedTasks.length}`);

    return NextResponse.json({
      success: true,
      tasks: tasks,
      folderName: folderName,
      totalTasks: images.length,
      submittedTasks: submittedTasks.length,
      failedTasks: failedTasks.length,
      message: `All tasks processed: ${submittedTasks.length} submitted, ${failedTasks.length} failed`
    });

  } catch (error) {
    console.error('Error in VolcEngine video generation:', error);
    return NextResponse.json(
      { error: 'Failed to process video generation request' },
      { status: 500 }
    );
  }
}

// Status check endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const volcEngineApiKey = process.env.VOLCENGINE_API_KEY;

    if (!volcEngineApiKey) {
      return NextResponse.json(
        { error: 'VolcEngine API key not found' },
        { status: 500 }
      );
    }

    console.log('Checking task status for:', taskId);

    try {
      // Query task status from VolcEngine ARK API
      const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${volcEngineApiKey}`
        }
      });

      console.log('VolcEngine status check response status:', response.status);
      console.log('VolcEngine status check response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('VolcEngine status check response text:', responseText);
      
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse JSON response in status check:', parseError);
        result = { error: { message: `Invalid JSON response: ${responseText}` } };
      }
      
      console.log('VolcEngine status check response:', result);

      // Check if the response is successful
      if (response.ok && result.id) {
        // Normalize VolcEngine response to match frontend expectations
        let status = result.status;
        let videoUrl = null;
        
        console.log('🔄 Status mapping - Original VolcEngine status:', status);
        
        // Convert VolcEngine status to frontend-expected format
        if (status === 'succeeded') {
          status = 'done'; // Frontend expects 'done' for completed videos
          videoUrl = result.content?.video_url || null;
        } else if (status === 'failed') {
          status = 'failed'; // Keep as 'failed'
        } else if (status === 'running') {
          status = 'processing';
        } else if (status === 'queued') {
          status = 'pending';
        }
        
        console.log('✅ Status mapping - Mapped status for frontend:', status);
        console.log('🎥 Video URL extracted:', videoUrl ? 'Available' : 'Not available');
        
        const responseData = {
          success: true,
          data: {
            task_id: result.id,
            status: status,
            video_url: videoUrl,
            error_message: result.error || null,
            created_at: result.created_at,
            updated_at: result.updated_at,
            usage: result.usage
          }
        };
        
        console.log('📤 Final response being sent to frontend:', JSON.stringify(responseData, null, 2));
        
        return NextResponse.json(responseData);
      } else {
        const errorMessage = result.error?.message || result.message || result.error || `HTTP ${response.status}: ${responseText}`;
        return NextResponse.json({
          success: false,
          data: {
            task_id: taskId,
            status: 'failed',
            error_message: errorMessage // Frontend expects 'error_message'
          }
        });
      }

    } catch (error) {
      console.error('Error checking task status:', error);
      return NextResponse.json({
        success: false,
        data: {
          task_id: taskId,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

  } catch (error) {
    console.error('Error in status check endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to check task status' },
      { status: 500 }
    );
  }
} 