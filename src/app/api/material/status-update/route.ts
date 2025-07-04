import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    
    console.log('🔍 DEBUG: Status-update API route authorization check:', {
      hasAuthHeader: !!authorization,
      authHeaderLength: authorization ? authorization.length : 0,
      authHeaderPreview: authorization ? authorization.substring(0, 30) + '...' : 'No auth header'
    });
    
    if (!authorization) {
      console.log('❌ DEBUG: No authorization header provided');
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    // Extract token from authorization header
    const token = authorization.replace('Bearer ', '');

    const body = await request.json();
    
    console.log('📥 Material status update API received JSON:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    const { materialId, dealStatus, msg, keyframesUrl } = body;
    
    if (!materialId || !dealStatus || msg === undefined || !keyframesUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: materialId, dealStatus, msg, keyframesUrl' },
        { status: 400 }
      );
    }

    // Validate materialId is a number
    if (typeof materialId !== 'number' || materialId <= 0) {
      return NextResponse.json(
        { error: 'materialId must be a positive number' },
        { status: 400 }
      );
    }

    // Validate dealStatus
    if (![1, 2].includes(dealStatus)) {
      return NextResponse.json(
        { error: 'Invalid dealStatus. Must be 1 (success) or 2 (failure)' },
        { status: 400 }
      );
    }

    // Validate msg is a string
    if (typeof msg !== 'string') {
      return NextResponse.json(
        { error: 'msg must be a string' },
        { status: 400 }
      );
    }

    // Validate keyframesUrl is a string
    if (typeof keyframesUrl !== 'string' || !keyframesUrl.trim()) {
      return NextResponse.json(
        { error: 'keyframesUrl must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log('🚀 Validated material status update request, proceeding to API call...', {
      materialId,
      dealStatus,
      hasKeyframesUrl: !!keyframesUrl
    });

    // Use ApiClient like the products API does
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);

    console.log('🔍 DEBUG: Making request via ApiClient to:', `/system/materialMgt/materialStatusSubmit`);

    try {
      const response = await apiClient.makeRequest('/system/materialMgt/materialStatusSubmit', {
        method: 'POST',
        body: JSON.stringify({
          materialId,
          dealStatus,
          msg,
          keyframesUrl
        })
      }) as any; // Type assertion to handle the unknown type

      console.log('🔍 DEBUG: ApiClient response:', {
        code: response.code,
        fullResponse: response
      });

      if (response.code === 200) {
        console.log('✅ DEBUG: Material status update successful');
        return NextResponse.json(response);
      } else {
        console.log('❌ DEBUG: Material status update failed with code:', response.code);
        return NextResponse.json(
          response,
          { status: response.code === 401 ? 401 : 400 }
        );
      }
    } catch (apiError) {
      console.error('❌ DEBUG: ApiClient error:', apiError);
      return NextResponse.json(
        { error: 'API request failed', details: apiError instanceof Error ? apiError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in material status update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 