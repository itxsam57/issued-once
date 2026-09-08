import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('production security headers', () => {
  it('defines a non-breaking baseline for every route', async () => {
    expect(nextConfig.headers).toBeTypeOf('function');

    const rules = await nextConfig.headers!();
    const globalRule = rules.find((rule) => rule.source === '/(.*)');
    expect(globalRule).toBeDefined();

    const headers = new Map(globalRule!.headers.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  });
});
