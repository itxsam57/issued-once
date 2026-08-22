import { NextRequest, NextResponse } from 'next/server';

const LEGACY_EXACT_PATHS = new Set([
  '/api/checkout/start',
  '/api/webhooks/fourthwall',
]);

function isDecommissioned(pathname: string) {
  return LEGACY_EXACT_PATHS.has(pathname) || pathname.startsWith('/api/internal/');
}

export function proxy(request: NextRequest) {
  if (isDecommissioned(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Legacy endpoint is disabled' },
      {
        status: 410,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/checkout/start',
    '/api/webhooks/fourthwall',
    '/api/internal/:path*',
  ],
};
