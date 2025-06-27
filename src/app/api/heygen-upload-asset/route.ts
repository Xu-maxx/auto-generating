import { NextRequest, NextResponse } from 'next/server';

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

    console.log('Uploading asset to HeyGen:', {
      filename: file.name,
      type: file.type,
      size: file.size
    });

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Upload to HeyGen with the file's actual content type
    const response = await fetch('https://upload.heygen.com/v1/asset', {
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
    return NextResponse.json(
      { error: 'Failed to upload asset to HeyGen' },
      { status: 500 }
    );
  }
} 