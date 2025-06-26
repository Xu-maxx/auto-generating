import { NextRequest, NextResponse } from 'next/server';
import { Signer } from '@volcengine/openapi';
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

// JIMeng API configuration
const JIMENG_ENDPOINT = 'visual.volcengineapi.com';
const REGION = 'cn-north-1';
const SERVICE = 'cv';

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
    const uniqueFilename = `jimeng-images/${generateUUID()}-${Date.now()}.${fileExtension}`;
    
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

interface JIMengRequest {
  prompt: string;
  images: Array<{
    url: string;
    filename: string;
  }>;
  folderName: string;
  aspectRatio?: string;
  seed?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: JIMengRequest = await request.json();
    const { prompt, images, folderName, aspectRatio = '16:9', seed = -1 } = body;

    const accessKeyIdRaw = process.env.JiMeng_AccessKeyId;
    const secretAccessKeyRaw = process.env.JiMeng_SecretAccessKey;

    if (!accessKeyIdRaw || !secretAccessKeyRaw) {
      return NextResponse.json(
        { error: 'JIMeng API credentials not found' },
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

    // AccessKeyId should be used as-is, but SecretAccessKey might need base64 decoding
    const accessKeyId = accessKeyIdRaw;
    let secretAccessKey = secretAccessKeyRaw;
    
    // Try to decode SecretAccessKey if it looks like base64
    try {
      const decodedSecret = Buffer.from(secretAccessKeyRaw, 'base64').toString('utf-8');
      // Check if decoded secret looks valid (no invalid Unicode characters)
      if (decodedSecret && decodedSecret.length > 0 && !decodedSecret.includes('')) {
        secretAccessKey = decodedSecret;
        console.log('Using base64 decoded SecretAccessKey');
      } else {
        console.log('Base64 decoded SecretAccessKey contains invalid characters, using raw');
      }
    } catch (error) {
      console.log('SecretAccessKey base64 decoding failed, using raw:', error);
    }
    
    console.log('Using AccessKeyId:', accessKeyId);
    console.log('SecretAccessKey length:', secretAccessKey.length);

    const tasks = [];
    
    console.log(`Setting up ${images.length} images for parallel processing (max 2 concurrent)...`);
    
    const maxInitialSubmissions = Math.min(2, images.length); // Submit up to 2 images initially
    
    // Initialize all tasks - first 2 will be submitted, others are queued
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      if (i < maxInitialSubmissions) {
        // Process the first 2 images immediately
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

        // Prepare request data for first image
        const requestData = {
          req_key: 'jimeng_vgfm_t2v_l20',
          prompt: prompt,
          seed: seed,
          aspect_ratio: aspectRatio,
          image_urls: [imageUrl],
          input_image_url: imageUrl
        };

        const payload = JSON.stringify(requestData);
        const queryString = 'Action=CVSync2AsyncSubmitTask&Version=2022-08-31';
        
        console.log('🚀 Final JIMeng API request details:', {
          imageUrl: imageUrl,
          imageUrlType: imageUrl.startsWith('https://') ? 'public' : 'local',
          prompt: prompt,
          aspectRatio: aspectRatio
        });
        console.log('📤 JIMeng request payload:', payload);

        // Use VolcEngine SDK for signing
        const openApiRequestData = {
          region: REGION,
          method: 'POST',
          params: {
            Action: 'CVSync2AsyncSubmitTask',
            Version: '2022-08-31'
          },
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Host': JIMENG_ENDPOINT
          },
          body: payload
        };

        const signer = new Signer(openApiRequestData, SERVICE);
        
        // Add authorization header using VolcEngine SDK
        signer.addAuthorization({
          accessKeyId,
          secretKey: secretAccessKey,
          sessionToken: ''
        });

        console.log('Request headers after signing:', openApiRequestData.headers);

        try {
          // Submit task to JIMeng API
          const response = await fetch(`https://${JIMENG_ENDPOINT}?${queryString}`, {
            method: 'POST',
            headers: openApiRequestData.headers,
            body: payload
          });

          const result = await response.json();
          console.log(`JIMeng API response for image ${i + 1}:`, result);
          
          // JIMeng API returns success with code 10000 and task_id in data field
          if (response.ok && result.code === 10000 && result.data?.task_id) {
            console.log(`✅ Successfully submitted task ${result.data.task_id} for image ${i + 1}`);
            tasks.push({
              taskId: result.data.task_id,
              imageIndex: i,
              imageName: image.filename,
              status: 'submitted',
              prompt: prompt,
              imageUrl: imageUrl // Store the processed image URL for later use
            });
          } else {
            console.error(`❌ JIMeng API error for image ${i + 1}:`, result);
            tasks.push({
              taskId: null,
              imageIndex: i,
              imageName: image.filename,
              status: 'failed',
              error: result.message || 'Unknown error'
            });
          }
        } catch (error) {
          console.error(`❌ Error submitting image ${i + 1} to JIMeng API:`, error);
          tasks.push({
            taskId: null,
            imageIndex: i,
            imageName: image.filename,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        // Mark remaining images as queued
        console.log(`Queuing image ${i + 1}: ${image.filename}`);
        tasks.push({
          taskId: null,
          imageIndex: i,
          imageName: image.filename,
          status: 'queued',
          prompt: prompt,
          imageUrl: image.url // Store original URL, will be processed when it's their turn
        });
      }
    }

    const submittedTasks = tasks.filter(t => t.status === 'submitted');
    const queuedTasks = tasks.filter(t => t.status === 'queued');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    console.log(`\n=== INITIAL SETUP SUMMARY ===`);
    console.log(`Total images: ${images.length}`);
    console.log(`Submitted (processing): ${submittedTasks.length}`);
    console.log(`Queued (waiting): ${queuedTasks.length}`);
    console.log(`Failed: ${failedTasks.length}`);

    return NextResponse.json({
      success: true,
      tasks: tasks,
      folderName: folderName,
      totalTasks: images.length,
      submittedTasks: submittedTasks.length,
      queuedTasks: queuedTasks.length,
      failedTasks: failedTasks.length,
      message: `Parallel processing started: ${submittedTasks.length} submitted, ${queuedTasks.length} queued, ${failedTasks.length} failed`
    });

  } catch (error) {
    console.error('Error in JIMeng video generation:', error);
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

    const accessKeyIdRaw = process.env.JiMeng_AccessKeyId;
    const secretAccessKeyRaw = process.env.JiMeng_SecretAccessKey;

    if (!accessKeyIdRaw || !secretAccessKeyRaw) {
      return NextResponse.json(
        { error: 'JIMeng API credentials not found' },
        { status: 500 }
      );
    }

    // AccessKeyId should be used as-is, but SecretAccessKey might need base64 decoding
    const accessKeyId = accessKeyIdRaw;
    let secretAccessKey = secretAccessKeyRaw;
    
    // Try to decode SecretAccessKey if it looks like base64
    try {
      const decodedSecret = Buffer.from(secretAccessKeyRaw, 'base64').toString('utf-8');
      if (decodedSecret && decodedSecret.length > 0 && !decodedSecret.includes('')) {
        secretAccessKey = decodedSecret;
      }
    } catch (error) {
      // Use raw if decoding fails
    }

    const queryString = `Action=CVSync2AsyncGetResult&Version=2022-08-31`;
    
    // Prepare request data for status check
    const requestData = {
      req_key: 'jimeng_vgfm_t2v_l20', // Use same req_key as submission
      task_id: taskId
    };

    const payload = JSON.stringify(requestData);
    
    // Use VolcEngine SDK for signing
    const openApiRequestData = {
      region: REGION,
      method: 'POST',
      params: {
        Action: 'CVSync2AsyncGetResult',
        Version: '2022-08-31'
      },
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Host': JIMENG_ENDPOINT
      },
      body: payload
    };

    const signer = new Signer(openApiRequestData, SERVICE);
    
    // Add authorization header using VolcEngine SDK
    signer.addAuthorization({
      accessKeyId,
      secretKey: secretAccessKey,
      sessionToken: ''
    });

    console.log('Status check request headers:', openApiRequestData.headers);
    console.log('Status check request payload:', payload);
    console.log('Status check request URL:', `https://${JIMENG_ENDPOINT}?${queryString}`);

    const response = await fetch(`https://${JIMENG_ENDPOINT}?${queryString}`, {
      method: 'POST',
      headers: openApiRequestData.headers,
      body: payload
    });

    const result = await response.json();
    console.log('JIMeng status check response:', result);

    // Check if the response is successful and contains result data
    if (response.ok && result.code === 10000) {
      return NextResponse.json({
        success: true,
        data: result.data // Return the data directly
      });
    } else {
      return NextResponse.json({
        success: false,
        data: result
      });
    }

  } catch (error) {
    console.error('Error checking task status:', error);
    return NextResponse.json(
      { error: 'Failed to check task status' },
      { status: 500 }
    );
  }
} 