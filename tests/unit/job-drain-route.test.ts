import { afterEach, expect, test, vi } from 'vitest';

const { drain, cleanupOtpRateLimits } = vi.hoisted(() => ({
  drain: vi.fn(),
  cleanupOtpRateLimits: vi.fn(),
}));

vi.mock('@/server/jobs/runtimeJobs', () => ({
  createIssuedOnceJobProcessor: () => ({ drain }),
}));

vi.mock('@/server/contact/runtimeContact', () => ({
  cleanupOtpRateLimits,
}));

import { POST } from '@/app/api/internal/jobs/drain/route';

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

function request(token?: string) {
  return new Request('https://issuedonce.shop/api/internal/jobs/drain', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test('job drain fails closed without the dedicated cron secret', async () => {
  process.env.CRON_SECRET = 'cron-secret-that-is-long-enough';

  await expect(POST(request())).resolves.toMatchObject({ status: 401 });
  await expect(POST(request('wrong-secret'))).resolves.toMatchObject({ status: 401 });
  expect(drain).not.toHaveBeenCalled();
  expect(cleanupOtpRateLimits).not.toHaveBeenCalled();
});

test('job drain requires safe cron configuration', async () => {
  await expect(POST(request('anything'))).resolves.toMatchObject({ status: 503 });
  process.env.CRON_SECRET = 'too-short';
  await expect(POST(request('too-short'))).resolves.toMatchObject({ status: 503 });
  expect(drain).not.toHaveBeenCalled();
  expect(cleanupOtpRateLimits).not.toHaveBeenCalled();
});

test('authorized cron drains bounded jobs and prunes stale OTP limiter state', async () => {
  process.env.CRON_SECRET = 'cron-secret-that-is-long-enough';
  drain.mockResolvedValueOnce({ claimed: 3, completed: 2, retried: 1, failed: 0 });
  cleanupOtpRateLimits.mockResolvedValueOnce(17);

  const response = await POST(request('cron-secret-that-is-long-enough'));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    claimed: 3,
    completed: 2,
    retried: 1,
    failed: 0,
    otpRateLimitsPruned: 17,
  });
  expect(drain).toHaveBeenCalledTimes(1);
  expect(drain).toHaveBeenCalledWith(expect.objectContaining({
    topics: ['issued-once-design', 'issued-once-notifications'],
    limit: 8,
  }));
  expect(cleanupOtpRateLimits).toHaveBeenCalledTimes(1);
});
