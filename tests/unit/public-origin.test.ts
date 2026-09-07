import { expect, test } from 'vitest';
import {
  buildPublicUrl,
  PublicOriginConfigurationError,
  resolvePublicOrigin,
} from '@/server/http/publicOrigin';

test('configured APP_ORIGIN wins over Hostinger internal request origin', () => {
  const env = { NODE_ENV: 'production', APP_ORIGIN: 'https://issuedonce.shop' } as NodeJS.ProcessEnv;
  expect(resolvePublicOrigin('https://0.0.0.0:3000/payment/return', env)).toBe('https://issuedonce.shop');
  expect(buildPublicUrl('/payment/pending', 'https://0.0.0.0:3000/payment/return', env).href)
    .toBe('https://issuedonce.shop/payment/pending');
});

test.each([
  'http://issuedonce.shop',
  'https://user:pass@issuedonce.shop',
  'https://issuedonce.shop/path',
  'https://issuedonce.shop/?q=1',
  'https://issuedonce.shop/#fragment',
  'https://0.0.0.0:3000',
  'https://127.0.0.1',
  'https://10.0.0.2',
  'https://192.168.1.20',
  'https://172.16.4.2',
])('production rejects unsafe APP_ORIGIN %s', (APP_ORIGIN) => {
  expect(() => resolvePublicOrigin('https://0.0.0.0:3000/', { NODE_ENV: 'production', APP_ORIGIN } as NodeJS.ProcessEnv))
    .toThrow(PublicOriginConfigurationError);
});

test('production fails closed when APP_ORIGIN is missing', () => {
  expect(() => resolvePublicOrigin('https://0.0.0.0:3000/', { NODE_ENV: 'production' } as NodeJS.ProcessEnv))
    .toThrow(PublicOriginConfigurationError);
});

test('test/dev may fall back to request origin when APP_ORIGIN is absent', () => {
  expect(resolvePublicOrigin('http://localhost:3000/begin', { NODE_ENV: 'test' } as NodeJS.ProcessEnv))
    .toBe('http://localhost:3000');
});
