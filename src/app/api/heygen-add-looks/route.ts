import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { avatarGroupId, imageKey, name } = await request.json();
    
    if (!avatarGroupId) {
      return NextResponse.json({ error: 'No avatar group ID provided' }, { status: 400 });
    }

    if (!imageKey) {
      return NextResponse.json({ error: 'No image key provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Adding look to avatar group:', {
      avatarGroupId,
      imageKey,
      name: name || 'New Look'
    });

    // Add look to existing avatar group
    const response = await fetch('https://api.heygen.com/v2/photo_avatar/avatar_group/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify({
        group_id: avatarGroupId,
        image_keys: [imageKey],
        name: name || 'New Look'
      }),
    });

    console.log('HeyGen add look response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen add look error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen add look error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen add look failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen add look success:', data);

    // Return the result
    return NextResponse.json({ 
      success: true,
      result: data.data || data
    });

  } catch (error) {
    console.error('Error adding look to avatar group:', error);
    return NextResponse.json(
      { error: 'Failed to add look to avatar group' },
      { status: 500 }
    );
  }
} 