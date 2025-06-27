import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { assetId, voiceId, text, title } = await request.json();
    
    if (!assetId) {
      return NextResponse.json({ error: 'No asset ID provided' }, { status: 400 });
    }

    if (!voiceId) {
      return NextResponse.json({ error: 'No voice ID provided' }, { status: 400 });
    }

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Generating video with HeyGen API:', {
      assetId,
      voiceId,
      text: text.substring(0, 50) + '...',
      title: title || 'Avatar Video'
    });

    // Create video generation request
    const videoRequest = {
      title: title || 'Avatar Video',
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: assetId,
            scale: 1.0,
            offset: { x: 0.0, y: 0.0 },
            talking_style: 'stable',
            expression: 'default'
          },
          voice: {
            type: 'text',
            voice_id: voiceId,
            input_text: text,
            speed: 1.0
          },
          background: {
            type: 'color',
            value: '#f6f6fc'
          }
        }
      ],
      dimension: {
        width: 1280,
        height: 720
      }
    };

    const response = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify(videoRequest),
    });

    console.log('HeyGen video generation response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen video generation error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen video generation error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen video generation failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen video generation success:', data);

    return NextResponse.json({ 
      success: true,
      videoId: data.video_id,
      data: data
    });

  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json(
      { error: 'Failed to generate video' },
      { status: 500 }
    );
  }
} 