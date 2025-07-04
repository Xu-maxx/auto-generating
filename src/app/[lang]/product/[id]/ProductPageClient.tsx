'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product, ProductStyle } from '@/types/product';
import ApiClient from '@/utils/apiClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface ProductPageClientProps {
  params: Promise<{ lang: string; id: string }>;
  dict: any;
}

export default function ProductPageClient({ params, dict }: ProductPageClientProps) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [productId, setProductId] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [productStyle, setProductStyle] = useState<ProductStyle | null>(null);
  const [loading, setLoading] = useState(true);
  const [styleLoading, setStyleLoading] = useState(false);
  const [showStyleForm, setShowStyleForm] = useState(false);
  const [newStyle, setNewStyle] = useState('');
  const [saving, setSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Get locale and product ID from params
  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.lang);
      setProductId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const apiClient = ApiClient.getInstance();
      if (!apiClient.isAuthenticated()) {
        router.push(`/${locale}/login`);
        return;
      }
      setAuthChecked(true);
    };
    
    if (locale) {
      checkAuth();
    }
  }, [locale, router]);

  // Load product data when productId is available and authenticated
  useEffect(() => {
    if (productId && authChecked) {
      loadProductData();
      loadProductStyle();
    }
  }, [productId, authChecked]);

  const loadProductData = async () => {
    try {
      setLoading(true);
      
      // Get token from ApiClient
      const apiClient = ApiClient.getInstance();
      const token = apiClient.getToken();
      
      if (!token) {
        router.push(`/${locale}/login`);
        return;
      }
      
      const response = await fetch(`/api/products?pageSize=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        const foundProduct = data.products.find((p: Product) => p.id === parseInt(productId));
        setProduct(foundProduct || null);
      } else {
        console.error('Error loading product:', data.error);
        if (data.error === 'Not authenticated') {
          const apiClient = ApiClient.getInstance();
          apiClient.clearToken();
          router.push(`/${locale}/login`);
        }
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductStyle = async () => {
    try {
      setStyleLoading(true);
      
      // Get token from ApiClient
      const apiClient = ApiClient.getInstance();
      const token = apiClient.getToken();
      
      if (!token) {
        router.push(`/${locale}/login`);
        return;
      }
      
      const response = await fetch(`/api/products/styles?productId=${productId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setProductStyle(data.style);
        if (!data.style) {
          setShowStyleForm(true);
        }
      }
    } catch (error) {
      console.error('Error loading product style:', error);
    } finally {
      setStyleLoading(false);
    }
  };

  const saveStyle = async () => {
    if (!newStyle.trim()) {
      alert('Please enter a style description');
      return;
    }

    try {
      setSaving(true);
      
      // Get token from ApiClient
      const apiClient = ApiClient.getInstance();
      const token = apiClient.getToken();
      
      if (!token) {
        router.push(`/${locale}/login`);
        return;
      }
      
      const response = await fetch('/api/products/styles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: parseInt(productId),
          style: newStyle.trim()
        }),
      });

      const data = await response.json();
      if (data.success) {
        setProductStyle(data.style);
        setShowStyleForm(false);
        setNewStyle('');
      } else {
        alert('Failed to save style: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving style:', error);
      alert('Failed to save style');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAvatarVideo = () => {
    // Navigate to avatar test page with product context
    router.push(`/${locale}/avatar-test?productId=${productId}&productName=${encodeURIComponent(product?.productName || '')}`);
  };

  const handleCreateMaterialVideo = () => {
    // Navigate to material page for material video creation
    router.push(`/${locale}/material/${productId}`);
  };

  const handleLogout = () => {
    const apiClient = ApiClient.getInstance();
    apiClient.clearToken();
    router.push(`/${locale}/login`);
  };

  // Show loading while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <span className="text-gray-600">Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <span className="text-gray-600">Loading product...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">❌</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Product Not Found</h3>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push(`/${locale}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${locale}`)}
                className="text-gray-600 hover:text-gray-900 flex items-center space-x-2"
              >
                <span>←</span>
                <span>Back to Products</span>
              </button>
              <div className="border-l h-6 border-gray-300"></div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{product.productName}</h1>
                <p className="text-gray-600 mt-1">{product.productNameChild}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher currentLocale={locale} dict={dict} />
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Product Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-700">Brand:</span>
              <span className="ml-2 text-gray-600">{product.productBrandName}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <span className="ml-2 text-gray-600">{product.productCategoryName}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Classification:</span>
              <span className="ml-2 text-gray-600">{product.productClassifyName}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Effect:</span>
              <span className="ml-2 text-gray-600">{product.productEffectName}</span>
            </div>
            {product.keyPoint && (
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700">Key Points:</span>
                <span className="ml-2 text-gray-600">{product.keyPoint}</span>
              </div>
            )}
          </div>
        </div>

        {/* Style Configuration */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Style Configuration</h2>
            {productStyle && (
              <button
                onClick={() => setShowStyleForm(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Edit Style
              </button>
            )}
          </div>
          
          {styleLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading style...</span>
            </div>
          ) : productStyle ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">{productStyle.style}</p>
              <p className="text-sm text-gray-500 mt-2">
                Updated: {new Date(productStyle.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No style configuration found for this product.</p>
              <button
                onClick={() => setShowStyleForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Set Up Style
              </button>
            </div>
          )}
        </div>

        {/* Video Creation Options */}
        {productStyle && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Video Creation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleCreateAvatarVideo}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-medium transition-colors text-left"
              >
                <div className="text-lg font-semibold mb-2">Create Avatar Video</div>
                <div className="text-sm text-green-100">Generate video with digital avatar</div>
              </button>
              <button
                onClick={handleCreateMaterialVideo}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg font-medium transition-colors text-left"
              >
                <div className="text-lg font-semibold mb-2">Create Material Video</div>
                <div className="text-sm text-purple-100">Generate product material video</div>
              </button>
            </div>
          </div>
        )}

        {/* Style Form Modal */}
        {showStyleForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {productStyle ? 'Edit Style' : 'Set Up Style'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowStyleForm(false);
                      setNewStyle('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="style" className="block text-sm font-medium text-gray-700 mb-2">
                      Style Description
                    </label>
                    <textarea
                      id="style"
                      value={newStyle}
                      onChange={(e) => setNewStyle(e.target.value)}
                      placeholder="Describe the visual style, lighting, coloring, mood, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowStyleForm(false);
                      setNewStyle('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveStyle}
                    disabled={saving || !newStyle.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-md transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Style'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 