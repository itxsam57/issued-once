import { afterEach, describe, expect, test, vi } from 'vitest';

const { migrateBatch, createQuizEncryptionRotationService } = vi.hoisted(() => ({
  migrateBatch: vi.fn(),
  createQuizEncryptionRotationService: vi.fn(),
}));

vi.mock('@/server/crypto/runtimeQuizEncryptionRotation', () => ({
  createQuizEncryptionRotationService,
}));

import { POST } from '@/app/api/internal/quiz-encryption/rotate/route';

const TOKEN = 'quiz-rotation-token-that-is-at-least-32-characters';

function request(token?: string, body?: unknown) {
  return new Request('https://issuedonce.shop/api/internal/quiz-encryption/rotate', {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.RUNTIME_PROVIDER;
  delete process.env.QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE;
  delete process.env.QUIZ_KEY_ROTATION_TOKEN;
  vi.clearAllMocks();
});

describe('POST /api/internal/quiz-encryption/rotate', () => {
  test('does not expose the rotation endpoint outside an explicitly allowed bridge runtime', async () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    const response = await POST(request(TOKEN));

    expect(response.status).toBe(404);
    expect(createQuizEncryptionRotationService).not.toHaveBeenCalled();
  });

  test('does not expose the route on Hostinger unless the one-time bridge flag is enabled', async () => {
    process.env.RUNTIME_PROVIDER = 'hostinger';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    const response = await POST(request(TOKEN));

    expect(response.status).toBe(404);
    expect(createQuizEncryptionRotationService).not.toHaveBeenCalled();
  });

  test('allows one bounded batch on Hostinger only with the explicit one-time bridge flag and token', async () => {
    process.env.RUNTIME_PROVIDER = 'hostinger';
    process.env.QUIZ_KEY_ROTATION_HOSTINGER_BRIDGE = 'enabled';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;
    createQuizEncryptionRotationService.mockReturnValue({ migrateBatch });
    migrateBatch.mockResolvedValue({ scanned: 100, migrated: 100, skipped: 0, failed: 0, remaining: 1768 });

    const response = await POST(request(TOKEN, { limit: 100 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(migrateBatch).toHaveBeenCalledWith(100);
    expect(payload).toEqual({ scanned: 100, migrated: 100, skipped: 0, failed: 0, remaining: 1768 });
    expect(Object.keys(payload).sort()).toEqual(['failed', 'migrated', 'remaining', 'scanned', 'skipped']);
  });

  test('fails closed when the dedicated rotation token is not safely configured', async () => {
    process.env.VERCEL_ENV = 'production';

    const response = await POST(request(TOKEN));

    expect(response.status).toBe(503);
    expect(createQuizEncryptionRotationService).not.toHaveBeenCalled();
  });

  test('rejects an incorrect rotation credential before touching the database', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    const response = await POST(request('wrong-token-that-is-at-least-32-characters'));

    expect(response.status).toBe(401);
    expect(createQuizEncryptionRotationService).not.toHaveBeenCalled();
  });

  test('rejects an unsafe batch limit', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;

    const response = await POST(request(TOKEN, { limit: 251 }));

    expect(response.status).toBe(400);
    expect(createQuizEncryptionRotationService).not.toHaveBeenCalled();
  });

  test('runs one bounded batch and returns aggregate counts only', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.QUIZ_KEY_ROTATION_TOKEN = TOKEN;
    createQuizEncryptionRotationService.mockReturnValue({ migrateBatch });
    migrateBatch.mockResolvedValue({ scanned: 100, migrated: 100, skipped: 0, failed: 0, remaining: 1747 });

    const response = await POST(request(TOKEN, { limit: 100 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(migrateBatch).toHaveBeenCalledWith(100);
    expect(payload).toEqual({ scanned: 100, migrated: 100, skipped: 0, failed: 0, remaining: 1747 });
    expect(Object.keys(payload).sort()).toEqual(['failed', 'migrated', 'remaining', 'scanned', 'skipped']);
  });
});
