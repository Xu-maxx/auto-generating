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
      console.log(`Audio upload attempt ${attempt}/${maxRetries}`);
      
      // Create fetch promise with 60-second timeout (more reasonable for file uploads)
      const fetchPromise = fetch(url, options);
      const timeoutPromise = createTimeoutPromise(60000); // 60 seconds
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // If we get here, the request succeeded
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`Audio upload attempt ${attempt} failed:`, error);
      
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
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    // Validate file type for audio
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (!validAudioTypes.includes(audioFile.type)) {
      console.log(`File type: ${audioFile.type}, attempting upload anyway...`);
    }

    // Validate file size (audio files can be larger than images)
    const maxSizeInBytes = 50 * 1024 * 1024; // 50MB for audio
    if (audioFile.size > maxSizeInBytes) {
      return NextResponse.json({ 
        error: `Audio file too large: ${(audioFile.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: 50MB.` 
      }, { status: 400 });
    }

    console.log('Uploading audio to HeyGen:', {
      filename: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Convert file to buffer (same pattern as working image upload)
    const buffer = await audioFile.arrayBuffer();

    // Upload to HeyGen using retry logic and proper timeout
    const response = await uploadWithRetry('https://upload.heygen.com/v1/asset', {
      method: 'POST',
      headers: {
        'Content-Type': audioFile.type || 'audio/mpeg', // Use the file's actual content type
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: buffer,
    });

    console.log('HeyGen audio upload response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen audio upload error (JSON):', errorData);
      } catch (e) {
        try {
          const textResponse = await response.text();
          console.error('HeyGen audio upload error (text):', textResponse);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}`, details: textResponse };
        } catch (e2) {
          console.error('Could not read error response:', e2);
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
      }
      
      return NextResponse.json({ 
        error: `HeyGen audio upload failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen audio upload success:', data);

    // Return the asset information in the same format as image upload
    return NextResponse.json({ 
      success: true,
      asset: {
        id: data.data?.id || data.id,
        name: data.data?.name || audioFile.name,
        fileType: data.data?.file_type || 'audio',
        url: data.data?.url || data.url,
        filename: audioFile.name,
        type: audioFile.type,
        size: audioFile.size,
        createdTs: data.data?.created_ts,
        folderId: data.data?.folder_id,
        meta: data.data?.meta
      }
    });

  } catch (error) {
    console.error('Error uploading audio to HeyGen:', error);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to upload audio to HeyGen';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Audio upload timeout - please try again with a smaller file or check your connection';
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