import type { NextConfig } from 'next';
import { resolveBuildReleaseId } from './src/server/runtime/releaseInfo';

const releaseId = resolveBuildReleaseId();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  generateBuildId: async () => releaseId,
  env: {
    ISSUED_ONCE_RELEASE_ID: releaseId,
  },
};

export default nextConfig;
