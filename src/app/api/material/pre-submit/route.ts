import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://server.videoplus.cc:8443';

function getFileTypeDescription(fileType: number): string {
  switch (fileType) {
    case 1002:
      return 'mp4';
    case 1008:
      return 'mov (透明背景)';
    case 2004:
      return 'png';
    case 2002:
      return 'jpg';
    default:
      return 'Unknown';
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    
    console.log('🔍 DEBUG: Pre-submit API route authorization check:', {
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
    
    console.log('📥 Material pre-submission API received JSON:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    const { materialType, materialFileType, productId, tags, keyframesUrl } = body;
    
    if (!materialType || !materialFileType || !productId || !tags || !keyframesUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: materialType, materialFileType, productId, tags, keyframesUrl' },
        { status: 400 }
      );
    }

    // Validate materialType
    if (![3001, 4001].includes(materialType)) {
      return NextResponse.json(
        { error: 'Invalid materialType. Must be 3001 (口播) or 4001 (空境)' },
        { status: 400 }
      );
    }

    // Validate materialFileType
    if (![1002, 1008, 2004, 2002].includes(materialFileType)) {
      return NextResponse.json(
        { error: 'Invalid materialFileType. Must be 1002 (mp4), 1008 (mov), 2004 (png), or 2002 (jpg)' },
        { status: 400 }
      );
    }

    // Validate tags format (only Chinese, English, numbers, and commas)
    const tagPattern = /^[a-zA-Z0-9\u4e00-\u9fa5,]+$/;
    if (!tagPattern.test(tags)) {
      return NextResponse.json(
        { error: 'Invalid tags format. Only Chinese, English, numbers, and commas are allowed' },
        { status: 400 }
      );
    }

    // Validate productId is a number
    if (typeof productId !== 'number' || productId <= 0) {
      return NextResponse.json(
        { error: 'productId must be a positive number' },
        { status: 400 }
      );
    }

    console.log('🚀 Validated material pre-submission request, proceeding to API call...', {
      materialType,
      materialFileType,
      productId,
      tagsLength: tags.length,
      hasKeyframesUrl: !!keyframesUrl
    });

    // Use ApiClient like the products API does
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);

    console.log('🔍 DEBUG: Making request via ApiClient to:', `/system/materialMgt/preSubmitGeneratedMaterial`);
    
    // Let's also test what the actual URL will be constructed as
    const API_BASE_URL = process.env.API_BASE_URL || 'http://api.vh.dev.vp/';
    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const endpoint = '/system/materialMgt/preSubmitGeneratedMaterial';
    const fullUrl = `${baseUrl}${endpoint}`;
    console.log('🔍 DEBUG: Full URL that will be constructed:', fullUrl);

    try {
      const requestBody = {
        materialType,
        materialFileType,
        productId,
        tags,
        keyframesUrl
      };
      
      const jsonBody = JSON.stringify(requestBody);
      console.log('🔍 DEBUG: Exact JSON being sent:', jsonBody);
      console.log('🔍 DEBUG: JSON validation - has double quotes:', jsonBody.includes('"'));
      console.log('🔍 DEBUG: JSON validation - no single quotes around strings:', !jsonBody.match(/'[^']*'/));
      
      const response = await apiClient.makeRequest('/system/materialMgt/preSubmitGeneratedMaterial', {
        method: 'POST',
        body: jsonBody
      }) as any; // Type assertion to handle the unknown type

      console.log('🔍 DEBUG: ApiClient response:', {
        code: response.code,
        hasData: !!response.data,
        fullResponse: response
      });

      if (response.code === 200) {
        console.log('✅ DEBUG: Material pre-submission successful');
        return NextResponse.json(response);
      } else {
        console.log('❌ DEBUG: Material pre-submission failed with code:', response.code);
        return NextResponse.json(
          response,
          { status: response.code === 401 ? 401 : 400 }
        );
      }
    } catch (apiError) {
      console.error('❌ DEBUG: ApiClient error:', apiError);
      
      // Let's try a few alternative endpoint variations to see if any work
      console.log('🔍 DEBUG: Trying alternative endpoints...');
      
      const alternativeEndpoints = [
        '/materialMgt/preSubmitGeneratedMaterial',
        '/system/material/preSubmitGeneratedMaterial', 
        '/api/system/materialMgt/preSubmitGeneratedMaterial',
        '/material/preSubmitGeneratedMaterial'
      ];
      
      for (const altEndpoint of alternativeEndpoints) {
        try {
          console.log(`🔍 DEBUG: Trying alternative endpoint: ${altEndpoint}`);
          
          const requestBody = {
            materialType,
            materialFileType,
            productId,
            tags,
            keyframesUrl
          };
          
          const jsonBody = JSON.stringify(requestBody);
          console.log(`🔍 DEBUG: JSON for ${altEndpoint}:`, jsonBody);
          
          const altResponse = await apiClient.makeRequest(altEndpoint, {
            method: 'POST',
            body: jsonBody
          }) as any;
          
          console.log(`✅ DEBUG: Alternative endpoint ${altEndpoint} worked!`, altResponse);
          return NextResponse.json(altResponse);
        } catch (altError) {
          console.log(`❌ DEBUG: Alternative endpoint ${altEndpoint} failed:`, altError instanceof Error ? altError.message : 'Unknown error');
        }
      }
      
      return NextResponse.json(
        { error: 'API request failed', details: apiError instanceof Error ? apiError.message : 'Unknown error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in material pre-submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 