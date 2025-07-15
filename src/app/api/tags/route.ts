import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';
import { TagsResponse } from '@/types/tag';

// GET all tags
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNum = parseInt(searchParams.get('pageNum') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100000');

    // Get token from request headers
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create a new ApiClient instance with the token
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);

    // Build query parameters for the API request
    const params = new URLSearchParams({
      pageNum: pageNum.toString(),
      pageSize: pageSize.toString(),
    });

    console.log('🔍 Calling tags API with params:', params.toString());
    
    const response = await apiClient.makeRequest<TagsResponse>(`/system/tagsMgt/list?${params}`);
    
    console.log('🔍 Tags API response:', {
      code: response.code,
      msg: response.msg,
      rowsCount: response.rows?.length || 0
    });
    
    if (response.code === 200) {
      return NextResponse.json({
        success: true,
        tags: response.rows || [],
        total: response.rows?.length || 0,
        msg: response.msg
      });
    } else {
      return NextResponse.json(
        { success: false, error: response.msg || 'Failed to fetch tags' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 