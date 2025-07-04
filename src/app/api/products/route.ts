import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';
import { ProductListResponse } from '@/types/product';

// GET all products with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNum = parseInt(searchParams.get('pageNum') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const orderByColumn = searchParams.get('orderByColumn') || 'id';
    const isAsc = searchParams.get('isAsc') || 'desc';
    const search = searchParams.get('search') || '';

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
      orderByColumn,
      isAsc,
    });

    // Add search parameter if provided
    if (search.trim()) {
      params.append('productName', search.trim());
    }

    const response = await apiClient.makeRequest<ProductListResponse>(`/product/product/list?${params}`);
    
    if (response.code === 200) {
      return NextResponse.json({
        success: true,
        products: response.rows,
        total: response.total,
        pageNum,
        pageSize,
        search
      });
    } else {
      return NextResponse.json(
        { success: false, error: response.msg || 'Failed to fetch products' },
        { status: response.code === 401 ? 401 : 400 }
      );
    }
  } catch (error) {
    console.error('Error in products API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
} 