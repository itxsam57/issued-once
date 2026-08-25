import { expect, test } from 'vitest';
import { clientIpRiskKey } from '@/server/http/clientIpRiskKey';

test('prefers proxy-observed X-Real-IP over a spoofable forwarded chain', () => {
  const headers = new Headers({
    'x-real-ip': '203.0.113.40',
    'x-forwarded-for': '198.51.100.10, 192.0.2.20',
  });

  expect(clientIpRiskKey(headers)).toBe('203.0.113.40');
});

test('falls back to the last non-empty X-Forwarded-For hop when X-Real-IP is unavailable', () => {
  const headers = new Headers({
    'x-forwarded-for': '198.51.100.10, , 192.0.2.20 ',
  });

  expect(clientIpRiskKey(headers)).toBe('192.0.2.20');
});

test('returns unknown instead of trusting blank proxy headers', () => {
  const headers = new Headers({
    'x-real-ip': '   ',
    'x-forwarded-for': ' , ',
  });

  expect(clientIpRiskKey(headers)).toBe('unknown');
});
