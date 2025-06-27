import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Fetching voices from HeyGen API...');

    const response = await fetch('https://api.heygen.com/v2/voices', {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
    });

    console.log('HeyGen list voices response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen list voices error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen list voices error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen list voices failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen list voices success:', data);

    // Extract voices from nested structure
    const voices = data.data?.voices || data.voices || [];
    console.log('Extracted voices count:', voices.length);

    return NextResponse.json({ 
      success: true,
      voices: voices
    });

  } catch (error) {
    console.error('Error listing voices:', error);
    return NextResponse.json(
      { error: 'Failed to list voices' },
      { status: 500 }
    );
  }
} 