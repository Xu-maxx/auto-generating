import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Proxying image download for:', imageUrl);

    // Validate URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'Invalid image URL' },
        { status: 400 }
      );
    }

    // Download the image on the server side (no CORS restrictions)
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'MaterialVideoSubmission/1.0'
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    console.log('✅ Image downloaded successfully:', {
      url: imageUrl,
      size: imageBuffer.byteLength,
      contentType
    });

    // Return the image data as base64
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${imageBase64}`;

    return NextResponse.json({
      success: true,
      dataUrl,
      contentType,
      size: imageBuffer.byteLength
    });

  } catch (error) {
    console.error('❌ Error proxying image download:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download image'
      },
      { status: 500 }
    );
  }
} 