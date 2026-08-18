import { NextRequest, NextResponse } from 'next/server';

const LEGACY_COMMERCE_PATHS = new Set([
  '/api/checkout/start',
  '/api/webhooks/fourthwall',
]);

export function proxy(request: NextRequest) {
  if (LEGACY_COMMERCE_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Legacy commerce endpoint is disabled' },
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
  ],
};
