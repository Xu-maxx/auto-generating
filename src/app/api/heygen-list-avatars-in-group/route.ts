import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ error: 'No group ID provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Listing avatars in group:', groupId);

    const response = await fetch(`https://api.heygen.com/v2/avatar_group/${groupId}/avatars`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
    });

    console.log('HeyGen list avatars in group response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen list avatars in group error:', errorData);
      } catch (e) {
        console.error('HeyGen list avatars in group error (non-JSON response):', response.status, response.statusText);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen list avatars in group failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen list avatars in group success:', data);

    return NextResponse.json({ 
      success: true,
      avatars: data.data?.avatar_list || data.avatar_list || []
    });

  } catch (error) {
    console.error('Error listing avatars in group:', error);
    return NextResponse.json(
      { error: 'Failed to list avatars in group' },
      { status: 500 }
    );
  }
} 