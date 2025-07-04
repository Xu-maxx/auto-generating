import { NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';

export async function GET() {
  try {
    const apiClient = ApiClient.getInstance();
    const captcha = await apiClient.getCaptcha();
    
    if (captcha.code === 200) {
      let imageData = captcha.img;
      
      // Handle different image formats
      if (typeof imageData === 'string') {
        if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
          // If it's a URL, try to fetch and convert to data URL
          try {
            const imageResponse = await fetch(imageData);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              const contentType = imageResponse.headers.get('content-type') || 'image/png';
              imageData = `data:${contentType};base64,${base64}`;
            }
          } catch (urlError) {
            // Fallback: return the URL as-is
            imageData = captcha.img;
          }
        } else if (!imageData.startsWith('data:')) {
          // Convert base64 string to data URL
          if (imageData.startsWith('/9j/') || imageData.startsWith('iVBORw0KGgo')) {
            // Common starts for JPEG and PNG base64
            const format = imageData.startsWith('/9j/') ? 'jpeg' : 'png';
            imageData = `data:image/${format};base64,${imageData}`;
          } else {
            // Default to PNG
            imageData = `data:image/png;base64,${imageData}`;
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        captcha: {
          img: imageData,
          uuid: captcha.uuid
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: captcha.msg || 'Failed to get captcha' },
        { status: 400 }
      );
    }
  } catch (error) {
    // Try direct API call as fallback
    try {
      const directResponse = await fetch(`${process.env.API_BASE_URL}/captchaImage`);
      
      if (directResponse.ok) {
        const contentType = directResponse.headers.get('content-type');
        
        if (contentType && contentType.startsWith('image/')) {
          // If response is an image directly, convert to base64
          const arrayBuffer = await directResponse.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const imageData = `data:${contentType};base64,${base64}`;
          
          return NextResponse.json({
            success: true,
            captcha: {
              img: imageData,
              uuid: `fallback-${Date.now()}` // Generate a fallback UUID
            }
          });
        } else {
          // Try to parse as JSON
          const directData = await directResponse.json();
          
          if (directData.code === 200) {
            let imageData = directData.img;
            
            // Apply same processing as above
            if (typeof imageData === 'string' && !imageData.startsWith('data:') && !imageData.startsWith('http')) {
              const format = imageData.startsWith('/9j/') ? 'jpeg' : 'png';
              imageData = `data:image/${format};base64,${imageData}`;
            }
            
            return NextResponse.json({
              success: true,
              captcha: {
                img: imageData,
                uuid: directData.uuid
              }
            });
          }
        }
      }
    } catch (directError) {
      // Continue to return error below
    }
    
    return NextResponse.json(
      { success: false, error: `Failed to fetch captcha: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 