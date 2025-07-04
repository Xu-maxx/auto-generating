import { NextRequest, NextResponse } from 'next/server';
import ApiClient from '@/utils/apiClient';
import { LoginResponse } from '@/types/product';

export async function POST(request: NextRequest) {
  try {
    const { username, password, code, uuid } = await request.json();
    
    if (!username || !password || !code || !uuid) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const apiClient = ApiClient.getInstance();
    const loginResponse = await apiClient.makeRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        code,
        uuid
      }),
    });

    if (loginResponse.code === 200 && loginResponse.token) {
      return NextResponse.json({
        success: true,
        token: loginResponse.token,
        message: 'Login successful'
      });
    } else {
      return NextResponse.json(
        { success: false, error: loginResponse.msg || 'Login failed' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
} 