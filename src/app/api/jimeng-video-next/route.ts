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

interface ProcessNextImageRequest {
  imageIndex: number;
  imageName: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  seed: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessNextImageRequest = await request.json();
    const { imageIndex, imageName, imageUrl, prompt, aspectRatio, seed } = body;

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

    console.log(`\n=== Processing next queued image: ${imageName} (index ${imageIndex}) ===`);
    
    let processedImageUrl = imageUrl;
    
    // Check if image URL is local and needs to be uploaded to OSS
    if (imageUrl.startsWith('/') || imageUrl.includes('localhost')) {
      console.log('Local image detected, uploading to OSS:', imageUrl);
      try {
        processedImageUrl = await uploadImageToOSS(imageUrl, imageName);
        console.log('Successfully uploaded to OSS, new URL:', processedImageUrl);
      } catch (error) {
        console.error('Failed to upload image to OSS:', error);
        return NextResponse.json({
          success: false,
          error: `Failed to upload image to OSS: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    } else {
      console.log('Using provided public URL:', processedImageUrl);
    }

    // Prepare request data
    const requestData = {
      req_key: "doubao-seedance-1-0-lite-i2v-250428",
      prompt: prompt,
      seed: seed,
      aspect_ratio: aspectRatio,
      image_urls: [processedImageUrl],
      input_image_url: processedImageUrl
    };

    const payload = JSON.stringify(requestData);
    const queryString = 'Action=CVSync2AsyncSubmitTask&Version=2022-08-31';
    
    console.log('Image URL:', processedImageUrl);
    console.log('JIMeng request data:', requestData);

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
      console.log('JIMeng API response for next image:', result);
      
      // JIMeng API returns success with code 10000 and task_id in data field
      if (response.ok && result.code === 10000 && result.data?.task_id) {
        console.log(`✅ Successfully submitted next task ${result.data.task_id} for image: ${imageName}`);
        
        return NextResponse.json({
          success: true,
          taskId: result.data.task_id,
          imageIndex: imageIndex,
          imageName: imageName,
          processedImageUrl: processedImageUrl
        });
      } else {
        console.error(`❌ JIMeng API error for next image:`, result);
        
        return NextResponse.json({
          success: false,
          error: result.message || 'Unknown error',
          imageIndex: imageIndex,
          imageName: imageName
        });
      }
    } catch (error) {
      console.error(`❌ Error submitting next image to JIMeng API:`, error);
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        imageIndex: imageIndex,
        imageName: imageName
      });
    }

  } catch (error) {
    console.error('Error in processing next image:', error);
    return NextResponse.json(
      { error: 'Failed to process next image request' },
      { status: 500 }
    );
  }
} 