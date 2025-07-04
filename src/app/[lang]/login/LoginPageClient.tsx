'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ApiClient from '@/utils/apiClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface LoginPageClientProps {
  params: Promise<{ lang: string }>;
  dict: any;
}

export default function LoginPageClient({ params, dict }: LoginPageClientProps) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaUuid, setCaptchaUuid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  // Get locale from params
  useEffect(() => {
    const getLocale = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.lang);
    };
    getLocale();
  }, [params]);

  // Check if already authenticated
  useEffect(() => {
    const apiClient = ApiClient.getInstance();
    if (apiClient.isAuthenticated()) {
      router.push(`/${locale}`);
    }
  }, [locale, router]);

  // Load captcha on mount
  useEffect(() => {
    loadCaptcha();
  }, []);

  const loadCaptcha = async () => {
    try {
      setLoadingCaptcha(true);
      setError('');
      
      const response = await fetch('/api/auth/captcha');
      const data = await response.json();
      
      if (data.success && data.captcha && data.captcha.img) {
        setCaptchaImage(data.captcha.img);
        setCaptchaUuid(data.captcha.uuid);
      } else {
        setError(data.error || 'Failed to load captcha');
      }
    } catch (error) {
      setError('Failed to load captcha');
    } finally {
      setLoadingCaptcha(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim() || !captchaCode.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (!captchaUuid) {
      setError('Please wait for captcha to load');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          code: captchaCode.trim(),
          uuid: captchaUuid
        }),
      });

      const data = await response.json();
      
      if (data.success && data.token) {
        // Store token in localStorage via ApiClient
        const apiClient = ApiClient.getInstance();
        apiClient.setToken(data.token);
        
        // Small delay to ensure token is properly set in localStorage
        setTimeout(() => {
          router.push(`/${locale}`);
        }, 100);
      } else {
        setError(data.error || 'Login failed');
        // Reload captcha on error
        loadCaptcha();
        setCaptchaCode('');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      loadCaptcha();
      setCaptchaCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access the product management system
          </p>
        </div>

        {/* Language Switcher */}
        <div className="flex justify-center">
          <LanguageSwitcher currentLocale={locale} dict={dict} />
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
            <div className="flex">
              <input
                id="captcha"
                name="captcha"
                type="text"
                required
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-bl-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Captcha Code"
              />
              <div className="flex-shrink-0">
                {loadingCaptcha ? (
                  <div className="w-24 h-10 bg-gray-200 border border-gray-300 rounded-br-md flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                ) : captchaImage ? (
                  <img
                    src={captchaImage}
                    alt="Captcha"
                    className="w-24 h-10 border border-gray-300 rounded-br-md cursor-pointer"
                    onClick={loadCaptcha}
                    title="Click to refresh"
                  />
                ) : (
                  <div className="w-24 h-10 bg-gray-100 border border-gray-300 rounded-br-md flex items-center justify-center cursor-pointer" onClick={loadCaptcha}>
                    <span className="text-xs text-gray-500">No Image</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || loadingCaptcha || !captchaImage}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={loadCaptcha}
              disabled={loadingCaptcha}
              className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
            >
              Refresh Captcha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 