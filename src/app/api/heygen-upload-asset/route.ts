import { NextRequest, NextResponse } from 'next/server';

// Helper function to create a timeout promise
const createTimeoutPromise = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
};

// Helper function to attempt upload with retry logic
const uploadWithRetry = async (url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> => {
  let lastError: Error = new Error('Unknown error occurred');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${maxRetries}`);
      
      // Create fetch promise with 60-second timeout (more reasonable for file uploads)
      const fetchPromise = fetch(url, options);
      const timeoutPromise = createTimeoutPromise(60000); // 60 seconds
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // If we get here, the request succeeded
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`Upload attempt ${attempt} failed:`, error);
      
      // If it's not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/png'];
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `Invalid file type: ${file.type}. Only JPEG and PNG images are supported.` 
      }, { status: 400 });
    }

    // Validate file size (HeyGen typically has size limits)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      return NextResponse.json({ 
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 10MB.` 
      }, { status: 400 });
    }

    console.log('Uploading asset to HeyGen:', {
      filename: file.name,
      type: file.type,
      size: file.size
    });

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Upload to HeyGen with retry logic and proper timeout
    const response = await uploadWithRetry('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: {
        'Content-Type': file.type, // Use the file's actual content type
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: buffer,
    });

    console.log('HeyGen upload response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen upload error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen upload error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen upload failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen upload success:', data);

    // Return the asset information
    return NextResponse.json({ 
      success: true,
      asset: {
        id: data.data.id,
        name: data.data.name,
        fileType: data.data.file_type,
        imageKey: data.data.image_key, // This is what we need for photo avatar creation
        url: data.data.url,
        createdTs: data.data.created_ts,
        folderId: data.data.folder_id,
        meta: data.data.meta
      }
    });

  } catch (error) {
    console.error('Error uploading asset to HeyGen:', error);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to upload asset to HeyGen';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Upload timeout - please try again with a smaller file or check your connection';
        statusCode = 408; // Request Timeout
      } else if (error.message.includes('fetch failed')) {
        errorMessage = 'Network connection failed - please check your internet connection';
        statusCode = 503; // Service Unavailable
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : String(error) },
      { status: statusCode }
    );
  }
} 