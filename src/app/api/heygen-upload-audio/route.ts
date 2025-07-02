import { NextRequest, NextResponse } from 'next/server';

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

    console.log('Uploading audio to HeyGen:', {
      filename: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Convert file to buffer (same pattern as working image upload)
    const buffer = await audioFile.arrayBuffer();

    // Upload to HeyGen using the same pattern as working image upload
    const response = await fetch('https://upload.heygen.com/v1/asset', {
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
    return NextResponse.json(
      { error: 'Failed to upload audio to HeyGen' },
      { status: 500 }
    );
  }
} 