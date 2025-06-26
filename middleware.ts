import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'zh'];
const defaultLocale = 'en';

// Get the preferred locale from the request
function getLocale(request: NextRequest): string {
  // Check if locale is in the pathname
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameLocale) return pathnameLocale;

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    // Simple language detection - check if Chinese is preferred
    if (acceptLanguage.includes('zh')) return 'zh';
    if (acceptLanguage.includes('en')) return 'en';
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('Middleware processing:', pathname);

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    console.log('Skipping middleware for:', pathname);
    return NextResponse.next();
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    console.log('Path already has locale:', pathname);
    return NextResponse.next();
  }

  // Redirect to locale-prefixed path
  const locale = getLocale(request);
  const newPath = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;
  const newUrl = new URL(newPath, request.url);
  
  console.log('Redirecting from', pathname, 'to', newPath);
  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: [
    // Match all requests except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 