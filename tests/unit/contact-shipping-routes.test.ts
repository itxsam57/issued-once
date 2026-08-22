import { beforeEach, expect, test, vi } from 'vitest';

const { cookiesMock, createContactServiceMock, createShippingServiceMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createContactServiceMock: vi.fn(),
  createShippingServiceMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/contact/runtimeContact', () => ({
  createContactService: createContactServiceMock,
  createShippingService: createShippingServiceMock,
  ContactRuntimeUnavailableError: class ContactRuntimeUnavailableError extends Error {},
}));

import { POST as requestOtp } from '@/app/api/contact/request-otp/route';
import { POST as verifyOtp } from '@/app/api/contact/verify-otp/route';
import { POST as saveShipping } from '@/app/api/shipping/route';

beforeEach(() => {
  vi.clearAllMocks();
  cookiesMock.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'session-token' }),
  });
});

test('request otp accepts only validated email and derives the risk key server-side', async () => {
  const request = vi.fn().mockResolvedValue({ challengeId: 'challenge-1', retryAfterSeconds: 60 });
  createContactServiceMock.mockReturnValue({ requestOtp: request });

  const response = await requestOtp(new Request('http://localhost/api/contact/request-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ email: 'Sam@Example.com', ipKey: 'attacker-controlled' }),
  }));

  expect(response.status).toBe(200);
  expect(request).toHaveBeenCalledWith({
    experienceToken: 'session-token',
    email: 'Sam@Example.com',
    ipKey: '203.0.113.9',
  });
  expect(await response.json()).toEqual({ challengeId: 'challenge-1', retryAfterSeconds: 60 });
});

test('verify otp binds challenge and code to the current anonymous experience cookie', async () => {
  const verify = vi.fn().mockResolvedValue({ verified: true });
  createContactServiceMock.mockReturnValue({ verifyOtp: verify });

  const response = await verifyOtp(new Request('http://localhost/api/contact/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: 'challenge-1', code: '123456' }),
  }));

  expect(response.status).toBe(200);
  expect(verify).toHaveBeenCalledWith({
    experienceToken: 'session-token',
    challengeId: 'challenge-1',
    code: '123456',
  });
});

test('shipping accepts only customer address fields and never client-supplied contact or issue ids', async () => {
  const save = vi.fn().mockResolvedValue({ saved: true });
  createShippingServiceMock.mockReturnValue({ save });
  const address = {
    recipientName: 'Sam Example', line1: '1 Quiet Street', line2: '', city: 'London',
    region: '', postalCode: 'SW1A 1AA', countryCode: 'GB', phone: '',
  };

  const response = await saveShipping(new Request('http://localhost/api/shipping', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...address, contactId: 'attacker-contact', issueId: 'attacker-issue' }),
  }));

  expect(response.status).toBe(200);
  expect(save).toHaveBeenCalledWith({ experienceToken: 'session-token', address });
});
