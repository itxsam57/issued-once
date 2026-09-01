import { NextRequest, NextResponse } from 'next/server';

const LEGACY_EXACT_PATHS = new Set([
  '/api/checkout/start',
  '/api/webhooks/fourthwall',
]);

const ACTIVE_INTERNAL_PATHS = new Set([
  '/api/internal/jobs/drain',
  '/api/internal/support-canary',
]);

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
} as const;

function isDecommissioned(pathname: string) {
  if (ACTIVE_INTERNAL_PATHS.has(pathname)) return false;
  return LEGACY_EXACT_PATHS.has(pathname) || pathname.startsWith('/api/internal/');
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export function proxy(request: NextRequest) {
  if (isDecommissioned(request.nextUrl.pathname)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: 'Legacy endpoint is disabled' },
        {
          status: 410,
          headers: {
            'cache-control': 'no-store',
          },
        },
      ),
    );
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
