import { LoginRequest, LoginResponse, CaptchaResponse, ProductListResponse } from '@/types/product';

const API_BASE_URL = process.env.API_BASE_URL || 'http://api.vh.dev.vp/';

class ApiClient {
  private token: string | null = null;
  private static instance: ApiClient;

  private constructor() {
    // Initialize token from localStorage when instance is created
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  setToken(token: string) {
    this.token = token;
    // Store token in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure proper URL concatenation without double slashes
    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  }

  async getCaptcha(): Promise<CaptchaResponse> {
    return this.makeRequest<CaptchaResponse>('/captchaImage');
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.code === 200 && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async getProducts(
    pageNum: number = 1,
    pageSize: number = 10,
    orderByColumn: string = 'id',
    isAsc: string = 'desc'
  ): Promise<ProductListResponse> {
    const params = new URLSearchParams({
      pageNum: pageNum.toString(),
      pageSize: pageSize.toString(),
      orderByColumn,
      isAsc,
    });

    return this.makeRequest<ProductListResponse>(`/product/product/list?${params}`);
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }
}

export default ApiClient; 