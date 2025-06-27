import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { avatarId } = await request.json();

    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID is required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Adding motion to avatar:', avatarId);

    const response = await fetch('https://api.heygen.com/v2/photo_avatar/add_motion', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: avatarId
      }),
    });

    console.log('HeyGen add motion response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen add motion error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen add motion error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `Failed to add motion to avatar: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen add motion success:', data);

    return NextResponse.json({ 
      success: true,
      motionAvatarId: data.data?.avatar_id || data.avatar_id,
      data: data.data
    });

  } catch (error) {
    console.error('Error adding motion to avatar:', error);
    return NextResponse.json(
      { error: 'Failed to add motion to avatar' },
      { status: 500 }
    );
  }
} 