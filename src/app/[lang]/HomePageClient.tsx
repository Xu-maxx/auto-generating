'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product, ProductStyle } from '@/types/product';
import ApiClient from '@/utils/apiClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface HomePageClientProps {
  params: Promise<{ lang: string }>;
  dict: any;
}

export default function HomePageClient({ params, dict }: HomePageClientProps) {
  const router = useRouter();
  const [locale, setLocale] = useState('en');
  const [products, setProducts] = useState<Product[]>([]);
  const [productStyles, setProductStyles] = useState<Record<number, ProductStyle>>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Get locale from params
  useEffect(() => {
    const getLocale = async () => {
      const resolvedParams = await params;
      setLocale(resolvedParams.lang);
    };
    getLocale();
  }, [params]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      // Small delay to ensure token is properly loaded from localStorage
      await new Promise(resolve => setTimeout(resolve, 50));
      
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

  // Load products on mount and when page changes
  useEffect(() => {
    if (authChecked) {
      loadProducts();
    }
  }, [currentPage, authChecked]);

  // Search effect - reset page when search query changes
  useEffect(() => {
    if (authChecked) {
      if (searchQuery !== '') {
        setCurrentPage(1);
      }
      // Small delay to allow state to update
      const timeoutId = setTimeout(() => {
        loadProducts();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, authChecked]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Get token from ApiClient
      const apiClient = ApiClient.getInstance();
      const token = apiClient.getToken();
      
      if (!token) {
        router.push(`/${locale}/login`);
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        pageNum: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const response = await fetch(`/api/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
        setTotalProducts(data.total);
        setTotalPages(Math.ceil(data.total / pageSize));
        
        // Load styles for all products
        await loadProductStyles(data.products);
      } else {
        console.error('Failed to load products:', data.error);
        // If authentication failed, redirect to login
        if (data.error === 'Not authenticated' || data.error === 'Failed to authenticate') {
          apiClient.clearToken();
          router.push(`/${locale}/login`);
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductStyles = async (productList: Product[]) => {
    try {
      const apiClient = ApiClient.getInstance();
      const token = apiClient.getToken();
      
      if (!token) {
        return;
      }
      
      const stylePromises = productList.map(async (product) => {
        const response = await fetch(`/api/products/styles?productId=${product.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        return { productId: product.id, style: data.style };
      });

      const styles = await Promise.all(stylePromises);
      const styleMap: Record<number, ProductStyle> = {};
      styles.forEach(({ productId, style }) => {
        if (style) {
          styleMap[productId] = style;
        }
      });
      setProductStyles(styleMap);
    } catch (error) {
      console.error('Error loading product styles:', error);
    }
  };

  const openProduct = (productId: number) => {
    router.push(`/${locale}/product/${productId}`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      // If search is cleared, reload all products
      setCurrentPage(1);
      loadProducts();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
    loadProducts();
  };

  const handleLogout = () => {
    const apiClient = ApiClient.getInstance();
    apiClient.clearToken();
    router.push(`/${locale}/login`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(i);
    }
    
    return buttons;
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
              <p className="text-gray-600 mt-1">Manage your product catalog and video creation</p>
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
          
          {/* Search Bar */}
          <div className="mt-6 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search products by name..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Results Indicator */}
        {searchQuery && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-800 font-medium">
                  Search results for "{searchQuery}" ({totalProducts} {totalProducts === 1 ? 'product' : 'products'} found)
                </span>
              </div>
              <button
                onClick={clearSearch}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Clear search
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">
              {searchQuery ? '🔍' : '📦'}
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {searchQuery ? 'No Products Found' : 'No Products Found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? `No products found matching "${searchQuery}". Try adjusting your search terms.`
                : 'Unable to load products from the server.'
              }
            </p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openProduct(product.id)}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{product.productName}</h3>
                      <div className="flex items-center">
                        {productStyles[product.id] ? (
                          <div className="w-3 h-3 bg-green-500 rounded-full" title="Style configured"></div>
                        ) : (
                          <div className="w-3 h-3 bg-gray-300 rounded-full" title="Style not configured"></div>
                        )}
                      </div>
                    </div>

                    {product.productNameChild && (
                      <p className="text-sm text-gray-600 mb-4">{product.productNameChild}</p>
                    )}

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">Brand:</span>
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{product.productBrandName}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2">Category:</span>
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{product.productCategoryName}</span>
                      </div>
                      {productStyles[product.id] && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium mr-2">Style:</span>
                          <span className="text-green-600">✓ Configured</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-6 py-3 rounded-b-lg">
                    <span className="text-sm text-blue-600 font-medium">
                      {productStyles[product.id] ? 'Manage Product' : 'Set Up Product'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {getPaginationButtons().map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 text-sm rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="mt-8 text-center text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalProducts)} of {totalProducts} products
            </div>
          </>
        )}
      </main>
    </div>
  );
} 