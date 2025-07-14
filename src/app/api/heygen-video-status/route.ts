import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'No video ID provided' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('Missing HEYGEN_API_KEY environment variable');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('Checking video status for:', videoId);

    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
    });

    console.log('HeyGen video status response status:', response.status, response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('HeyGen video status error:', errorData);
      } catch (e) {
        const textResponse = await response.text();
        console.error('HeyGen video status error (non-JSON):', textResponse);
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      return NextResponse.json({ 
        error: `HeyGen video status check failed: ${errorData.message || 'Unknown error'}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('HeyGen video status success:', data);

    // Handle different response structures from HeyGen API
    let videoData;
    let success = false;
    
    if (data.code === 100 && data.data) {
      // Standard HeyGen API response structure
      videoData = data.data;
      success = true;
    } else if (data.success && data.data) {
      // Alternative response structure
      videoData = data.data;
      success = true;
    } else if (data.status) {
      // Direct status in response
      videoData = data;
      success = true;
    } else {
      // Fallback for unknown structures
      videoData = data.data || data;
      success = !!videoData;
    }

    if (!success || !videoData) {
      return NextResponse.json({ 
        error: 'Invalid response structure from HeyGen API',
        details: data
      }, { status: 500 });
    }

    // Extract video information with proper fallbacks
    const videoStatus = videoData.status || 'unknown';
    const videoUrl = videoData.video_url || videoData.videoUrl || null;
    const thumbnailUrl = videoData.thumbnail_url || videoData.thumbnailUrl || null;
    const duration = videoData.duration || null;
    const gifUrl = videoData.gif_url || videoData.gifUrl || null;

    console.log('📊 Extracted video status data:', {
      videoId,
      status: videoStatus,
      hasVideoUrl: !!videoUrl,
      hasThumbnailUrl: !!thumbnailUrl,
      duration,
      isCompleted: videoStatus === 'completed',
      isFailed: videoStatus === 'failed'
    });

    return NextResponse.json({ 
      success: true,
      status: videoStatus,
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      duration: duration,
      gifUrl: gifUrl,
      data: videoData,
      // Include additional fields for debugging
      _debug: {
        originalResponseCode: data.code,
        originalResponseMessage: data.message,
        extractedStatus: videoStatus,
        shouldStopPolling: videoStatus === 'completed' || videoStatus === 'failed'
      }
    });

  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: 'Failed to check video status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 