import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageKey, avatarName } = await request.json();
    
    if (!imageKey) {
      return NextResponse.json({ error: 'No image key provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Creating photo avatar group:', {
      imageKey,
      avatarName: avatarName || 'Generated Avatar'
    });

    // Create photo avatar group
    const response = await fetch('https://api.heygen.com/v2/photo_avatar/avatar_group/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify({
        name: avatarName || 'Generated Avatar',
        image_key: imageKey
      }),
    });

    console.log('HeyGen create avatar group response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen create avatar group error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen create avatar group error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen avatar group creation failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen create avatar group success:', data);

    // Return the avatar group information
    return NextResponse.json({ 
      success: true,
      avatarGroup: {
        id: data.data.id,
        name: data.data.name,
        status: data.data.status,
        createdAt: data.data.created_at,
        updatedAt: data.data.updated_at
      }
    });

  } catch (error) {
    console.error('Error creating avatar group in HeyGen:', error);
    return NextResponse.json(
      { error: 'Failed to create avatar group in HeyGen' },
      { status: 500 }
    );
  }
} 