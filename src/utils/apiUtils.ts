/**
 * Get the base URL for API calls
 * This ensures proper endpoint resolution for both local and remote access
 */
export const getBaseUrl = (): string => {
  // In browser environment, use the current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // In server environment or fallback
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
};

/**
 * Make an API call with proper endpoint resolution
 */
export const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : endpoint;
  
  console.log('🌐 Making API call to:', url);
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}; 