import { NextRequest, NextResponse } from 'next/server';
import OSS from 'ali-oss';
import crypto from 'crypto';

// Simple UUID generator
const generateUUID = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

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

export async function POST(request: NextRequest) {
  try {
    // Check if OSS is configured
    const ossConfigured = process.env.OSS_ACCESS_KEY_ID && 
                         process.env.OSS_ACCESS_KEY_SECRET && 
                         process.env.OSS_BUCKET_NAME;

    if (!ossConfigured) {
      return NextResponse.json(
        { success: false, error: 'OSS not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Uploading reference image to OSS:', {
      filename: filename || file.name,
      size: file.size,
      type: file.type
    });

    const client = getOSSClient();
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generate unique filename
    const fileExtension = (filename || file.name).split('.').pop() || 'jpg';
    const uniqueFilename = `reference-images/${generateUUID()}-${Date.now()}.${fileExtension}`;
    
    // Upload to OSS
    const result = await client.put(uniqueFilename, buffer, {
      headers: {
        'Content-Type': file.type || `image/${fileExtension}`,
        'Cache-Control': 'public, max-age=31536000'
      }
    });
    
    // Generate public URL
    const publicUrl = `https://${process.env.OSS_BUCKET_NAME}.${process.env.OSS_REGION || 'oss-cn-hangzhou'}.aliyuncs.com/${uniqueFilename}`;
    
    console.log('Reference image uploaded to OSS successfully:', {
      ossResult: result.name,
      publicUrl: publicUrl
    });
    
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: uniqueFilename
    });

  } catch (error) {
    console.error('Error uploading reference image to OSS:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
} 