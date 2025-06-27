import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const photoAvatarId = searchParams.get('id');

    if (!photoAvatarId) {
      return NextResponse.json({ error: 'No photo avatar ID provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Getting photo avatar details for:', photoAvatarId);

    const response = await fetch(`https://api.heygen.com/v2/photo_avatar/${photoAvatarId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
    });

    console.log('HeyGen photo avatar details response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen photo avatar details error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen photo avatar details error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen photo avatar details failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen photo avatar details success:', data);

    return NextResponse.json({ 
      success: true,
      photoAvatar: data.data || data
    });

  } catch (error) {
    console.error('Error getting photo avatar details:', error);
    return NextResponse.json(
      { error: 'Failed to get photo avatar details' },
      { status: 500 }
    );
  }
} 