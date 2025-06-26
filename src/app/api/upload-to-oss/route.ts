import { NextRequest, NextResponse } from 'next/server';
import OSS from 'ali-oss';
import crypto from 'crypto';

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const originalFilename = formData.get('originalFilename') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = originalFilename?.split('.').pop() || 'jpg';
    const uniqueFilename = `jimeng-images/${generateUUID()}-${Date.now()}.${fileExtension}`;

    console.log('Uploading to OSS:', {
      originalFilename,
      uniqueFilename,
      fileSize: file.size,
      fileType: file.type
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize OSS client
    const client = getOSSClient();

    // Upload to OSS
    const result = await client.put(uniqueFilename, buffer, {
      headers: {
        'Content-Type': file.type,
        'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
      }
    });

    console.log('OSS upload result:', {
      name: result.name,
      url: result.url,
      res: result.res?.status
    });

    // Generate public URL
    const publicUrl = `https://${process.env.OSS_BUCKET_NAME}.${process.env.OSS_REGION || 'oss-cn-hangzhou'}.aliyuncs.com/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: uniqueFilename,
      originalFilename: originalFilename,
      size: file.size
    });

  } catch (error) {
    console.error('Error uploading to OSS:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload image to OSS',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 