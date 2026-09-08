import type { NextConfig } from 'next';
import { resolveBuildReleaseId } from './src/server/runtime/releaseInfo';

const releaseId = resolveBuildReleaseId();

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: 'tsconfig.next.json',
  },
  poweredByHeader: false,
  generateBuildId: async () => releaseId,
  env: {
    ISSUED_ONCE_RELEASE_ID: releaseId,
  },
  redirects: async () => [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.issuedonce.shop' }],
      destination: 'https://issuedonce.shop/:path*',
      permanent: true,
    },
  ],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],
};

export default nextConfig;
