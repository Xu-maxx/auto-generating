import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/utils/sessionManager';
import ApiClient from '@/utils/apiClient';
import { Product } from '@/types/product';

// GET all sessions for a product
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Verify product exists
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);
    
    try {
      const productResponse = await apiClient.getProducts(1, 1000);
      const product = productResponse.rows?.find((p: Product) => p.id === parseInt(productId));
      
      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        );
      }
      
      const sessions = await SessionManager.getSessionsByProduct(productId);
      return NextResponse.json({ success: true, sessions });
    } catch (apiError) {
      console.error('Error fetching product:', apiError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch product information' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching product sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product sessions' },
      { status: 500 }
    );
  }
}

// POST create new session for a product
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { name } = await request.json();
    
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Verify product exists
    const apiClient = ApiClient.getInstance();
    apiClient.setToken(token);
    
    try {
      const productResponse = await apiClient.getProducts(1, 1000);
      const product = productResponse.rows?.find((p: Product) => p.id === parseInt(productId));
      
      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        );
      }
      
      const session = await SessionManager.createSessionForProduct(name || 'Untitled', productId);
      return NextResponse.json({ success: true, session });
    } catch (apiError) {
      console.error('Error fetching product:', apiError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch product information' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
} 