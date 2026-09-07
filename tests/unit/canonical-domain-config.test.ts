import { expect, test } from 'vitest';
import nextConfig from '../../next.config';

test('www canonicalizes to apex without a Vercel dependency', async () => {
  expect(nextConfig.redirects).toBeTypeOf('function');
  const rules = await nextConfig.redirects!();
  expect(rules).toContainEqual({
    source: '/:path*',
    has: [{ type: 'host', value: 'www.issuedonce.shop' }],
    destination: 'https://issuedonce.shop/:path*',
    permanent: true,
  });
});
